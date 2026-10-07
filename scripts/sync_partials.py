#!/usr/bin/env python3
"""Copy the shared icons, nav and footer into every page.

    python3 scripts/sync_partials.py          # update every page
    python3 scripts/sync_partials.py --check  # only check; exit 1 if a page is out of date

The site is plain static HTML, so each page keeps its own copy of partials/*.html
between <!-- partial:NAME start --> and <!-- partial:NAME end --> markers.
Placeholders are filled in per page (see PAGES):

    {{ROOT}}       prefix for files: "" at the top level, "../" in projects/
    {{HOME}}       the home page in links like {{HOME}}#about ("" on the home page itself)
    {{HOME_LINK}}  where the duck logo goes: "#top" on the home page, the home page elsewhere
    {{CURRENT:x}}  aria-current="page" on pages whose "current" is x, else nothing
"""

import argparse
import re
import sys
from fnmatch import fnmatch
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
PARTIALS = ["icons", "nav", "footer"]

# Per-page settings. The first matching pattern wins.
# A new page must match one of these, or the script stops with an error.
PAGES = [
    ("index.html", {"ROOT": "", "HOME": "", "HOME_LINK": "#top", "current": None}),
    ("learn.html", {"ROOT": "", "HOME": "index.html", "HOME_LINK": "index.html", "current": "learn"}),
    # GitHub Pages serves 404.html for any missing address, at any depth,
    # so its links must start from the site root.
    ("404.html", {"ROOT": "/", "HOME": "/index.html", "HOME_LINK": "/index.html", "current": None}),
    ("projects/*.html", {"ROOT": "../", "HOME": "../index.html", "HOME_LINK": "../index.html", "current": "projects"}),
]

PLACEHOLDER = re.compile(r"\{\{([A-Z_]+)(?::([a-z]+))?\}\}")


def settings_for(rel_path):
    for pattern, settings in PAGES:
        if fnmatch(rel_path, pattern):
            return settings
    return None


def render(partial_text, settings):
    """Fill in the placeholders of one partial for one page."""

    def fill(match):
        name, arg = match.group(1), match.group(2)
        if name == "CURRENT":
            return ' aria-current="page"' if arg == settings["current"] else ""
        if name in settings:
            return settings[name]
        raise ValueError("unknown placeholder {{%s}}" % name)

    return PLACEHOLDER.sub(fill, partial_text)


def marker_block(name):
    """Regex for one marked block. The markers themselves are kept."""
    return re.compile(
        r"(?P<start>[ \t]*<!-- partial:%s start -->\n)(?P<body>.*?)(?P<end>[ \t]*<!-- partial:%s end -->)"
        % (name, name),
        re.S,
    )


def sync_page(path, partials):
    """Return the page text with every partial copied in."""
    rel = path.relative_to(SITE).as_posix()
    settings = settings_for(rel)
    if settings is None:
        raise SystemExit("%s: no entry in PAGES; add one to scripts/sync_partials.py" % rel)
    text = path.read_text(encoding="utf-8")
    for name in PARTIALS:
        pattern = marker_block(name)
        found = pattern.findall(text)
        if len(found) != 1:
            raise SystemExit(
                "%s: expected exactly one '<!-- partial:%s start/end -->' pair, found %d" % (rel, name, len(found))
            )
        body = render(partials[name], settings)
        text = pattern.sub(lambda m, body=body: m.group("start") + body + m.group("end"), text)
    return text


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--check", action="store_true", help="do not write; exit with an error if any page is out of date"
    )
    args = parser.parse_args()

    partials = {}
    for name in PARTIALS:
        text = (SITE / "partials" / (name + ".html")).read_text(encoding="utf-8")
        partials[name] = text if text.endswith("\n") else text + "\n"

    pages = sorted(SITE.glob("*.html")) + sorted(SITE.glob("projects/*.html"))
    out_of_date = []
    for path in pages:
        new_text = sync_page(path, partials)
        if new_text != path.read_text(encoding="utf-8"):
            out_of_date.append(path.relative_to(SITE).as_posix())
            if not args.check:
                path.write_text(new_text, encoding="utf-8")

    if args.check:
        if out_of_date:
            print("These pages do not match partials/:", file=sys.stderr)
            for rel in out_of_date:
                print("  " + rel, file=sys.stderr)
            print("Run: python3 scripts/sync_partials.py", file=sys.stderr)
            return 1
        print("All %d pages match partials/." % len(pages))
        return 0

    if out_of_date:
        print("Updated: " + ", ".join(out_of_date))
    else:
        print("All %d pages were already up to date." % len(pages))
    return 0


if __name__ == "__main__":
    sys.exit(main())
