"""Tests for scripts/sync_partials.py (run: python3 -m unittest discover -s tests).

Each test builds a small fake site in a temporary folder and points the script at it."""

import contextlib
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
import sync_partials  # noqa: E402

NAV = (
    '<a href="{{HOME_LINK}}">duck</a> <a href="{{HOME}}#about">About</a> '
    '<a href="{{ROOT}}learn.html"{{CURRENT:learn}}>Learn</a>'
)


def page(nav="old", icons="old", footer="old"):
    return (
        "<body>\n"
        "  <!-- partial:icons start -->\n%s\n  <!-- partial:icons end -->\n"
        "  <!-- partial:nav start -->\n%s\n  <!-- partial:nav end -->\n"
        "  <!-- partial:footer start -->\n%s\n  <!-- partial:footer end -->\n"
        "</body>\n"
    ) % (icons, nav, footer)


class SyncPartialsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.site = Path(self.tmp.name)
        patcher = mock.patch.object(sync_partials, "SITE", self.site)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.tmp.cleanup)
        self.write("partials/icons.html", "<svg></svg>")
        self.write("partials/nav.html", NAV + "\n")
        self.write("partials/footer.html", "<footer>{{ROOT}}x</footer>\n")
        for rel in ["index.html", "learn.html", "404.html", "projects/demo.html"]:
            self.write(rel, page())

    def write(self, rel, text):
        path = self.site / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def read(self, rel):
        return (self.site / rel).read_text(encoding="utf-8")

    def run_main(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with (
            mock.patch.object(sys, "argv", ["sync_partials.py", *args]),
            contextlib.redirect_stdout(out),
            contextlib.redirect_stderr(err),
        ):
            code = sync_partials.main()
        return code, out.getvalue(), err.getvalue()

    def test_render_fills_placeholders_per_page(self):
        cases = {
            "index.html": '<a href="#top">duck</a> <a href="#about">About</a> <a href="learn.html">Learn</a>',
            "learn.html": '<a href="index.html">duck</a> <a href="index.html#about">About</a> '
            '<a href="learn.html" aria-current="page">Learn</a>',
            "404.html": '<a href="/index.html">duck</a> <a href="/index.html#about">About</a> '
            '<a href="/learn.html">Learn</a>',
            "projects/demo.html": '<a href="../index.html">duck</a> <a href="../index.html#about">About</a> '
            '<a href="../learn.html">Learn</a>',
        }
        for rel, nav in cases.items():
            self.assertEqual(sync_partials.render(NAV, sync_partials.settings_for(rel)), nav, rel)

    def test_unknown_placeholder_fails(self):
        with self.assertRaisesRegex(ValueError, r"unknown placeholder \{\{NOPE\}\}"):
            sync_partials.render("{{NOPE}}", sync_partials.settings_for("index.html"))

    def test_settings_for_unknown_page(self):
        self.assertIsNone(sync_partials.settings_for("blog/post.html"))

    def test_main_updates_pages_and_keeps_markers(self):
        code, out, _ = self.run_main()
        self.assertEqual(code, 0)
        self.assertEqual(out, "Updated: 404.html, index.html, learn.html, projects/demo.html\n")
        self.assertEqual(
            self.read("projects/demo.html"),
            page(
                nav=sync_partials.render(NAV, sync_partials.settings_for("projects/demo.html")),
                icons="<svg></svg>",
                footer="<footer>../x</footer>",
            ),
        )
        self.assertEqual(self.run_main(), (0, "All 4 pages were already up to date.\n", ""))

    def test_check_reports_without_writing(self):
        before = self.read("index.html")
        code, out, err = self.run_main("--check")
        self.assertEqual((code, out), (1, ""))
        self.assertEqual(
            err,
            "These pages do not match partials/:\n  404.html\n  index.html\n  learn.html\n"
            "  projects/demo.html\nRun: python3 scripts/sync_partials.py\n",
        )
        self.assertEqual(self.read("index.html"), before)
        self.run_main()
        self.assertEqual(self.run_main("--check"), (0, "All 4 pages match partials/.\n", ""))

    def test_page_without_markers_fails(self):
        self.write("learn.html", "<body></body>\n")
        with self.assertRaisesRegex(SystemExit, "learn.html: expected exactly one '<!-- partial:icons"):
            self.run_main()

    def test_page_missing_from_pages_list_fails(self):
        self.write("about.html", page())
        with self.assertRaisesRegex(SystemExit, "about.html: no entry in PAGES"):
            self.run_main()


if __name__ == "__main__":
    unittest.main()
