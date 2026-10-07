"""Tests for scripts/sync_interview_prep.py (run: python3 -m unittest discover -s tests).

Each test builds a small fake interview-prep checkout in a temporary folder."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
import sync_interview_prep as sync  # noqa: E402

LEETCODE, GROUPS = sync.site_ids()
TITLES = {"go": "4. Go", "concepts:networking": "5. Networking concepts", "concepts:linux": "6. Linux & OS concepts",
          "concepts:testing": "7. Testing / QA concepts", "concepts:devops": "8. DevOps concepts",
          "concepts:security": "9. Security concepts"}


def readme(ticked=(), extra_go=0, coding=("1. Two Sum", "217. Contains Duplicate")):
    """A README shaped like the real one; `ticked` lists labels to mark [x]."""
    lines = ["# interview-prep", "", "## 1. Coding (Python)"]
    lines += ["- [%s] %s" % ("x" if c in ticked else " ", c) for c in coding]
    lines += ["", "## 2. SQL", "- [ ] 175. Combine Two Tables", "", "## 3. Bash", "- [ ] 195. Tenth Line"]
    for kind, title in TITLES.items():
        lines += ["", "## " + title]
        n = len(GROUPS[kind]) + (extra_go if kind == "go" else 0)
        lines += ["- [%s] %s item %d" % ("x" if (kind, i) in ticked else " ", kind, i) for i in range(n)]
    return "\n".join(lines) + "\n"


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.src = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, rel, text):
        path = os.path.join(self.src, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        return path

    def test_status_comes_from_checkbox_and_solution_files(self):
        self.write("README.md", readme(ticked={"1. Two Sum", ("concepts:security", 0)}))
        self.write("leetcode/0217_contains_duplicate.py", "def f():\n    pass\n")
        progress, solutions = sync.build(self.src, "2026-10-07")
        items = progress["items"]
        self.assertEqual(items["lc-1"], "Done")
        self.assertEqual(items["lc-217"], "In progress")
        self.assertEqual(items["lc-sql-175"], "Not started")
        self.assertEqual(items[GROUPS["concepts:security"][0]], "Done")
        self.assertEqual(items[GROUPS["concepts:security"][1]], "Not started")
        self.assertEqual(progress["updated"], "2026-10-07")
        # The site's own SQL playground items are kept from data/my-progress.json.
        self.assertIn("sql-01", items)

    def test_solution_code_and_link(self):
        self.write("README.md", readme())
        self.write("sql/0175_combine_two_tables.sql", "SELECT 1;\n")
        sol = sync.build(self.src, "x")[1]["solutions"]["lc-sql-175"]
        self.assertEqual(sol["language"], "sql")
        self.assertEqual(sol["code"], "SELECT 1;")
        self.assertEqual(sol["url"], sync.REPO_URL + "sql/0175_combine_two_tables.sql")

    def test_large_file_gets_a_link_but_no_code(self):
        self.write("README.md", readme())
        self.write("bash/0195_tenth_line.sh", "x" * (sync.MAX_CODE_BYTES + 1))
        sol = sync.build(self.src, "x")[1]["solutions"]["lc-bash-195"]
        self.assertNotIn("code", sol)
        self.assertIn("url", sol)

    def test_symlinks_are_ignored(self):
        self.write("README.md", readme())
        target = self.write("secret.txt", "do not publish")
        os.makedirs(os.path.join(self.src, "leetcode"))
        os.symlink(target, os.path.join(self.src, "leetcode", "0001_two_sum.py"))
        self.assertNotIn("lc-1", sync.build(self.src, "x")[1]["solutions"])

    def test_section_size_mismatch_fails(self):
        self.write("README.md", readme(extra_go=1))
        with self.assertRaisesRegex(sync.SyncError, "go"):
            sync.build(self.src, "x")

    def test_unknown_leetcode_problem_fails(self):
        self.write("README.md", readme(coding=("99999. Not On The Site",)))
        with self.assertRaisesRegex(sync.SyncError, "lc-99999"):
            sync.build(self.src, "x")

    def test_solution_for_unlisted_item_fails(self):
        self.write("README.md", readme())
        self.write("leetcode/0042_trapping_rain_water.py", "pass\n")
        with self.assertRaisesRegex(sync.SyncError, "lc-42"):
            sync.build(self.src, "x")

    def test_main_writes_both_files(self):
        self.write("README.md", readme())
        out = os.path.join(self.src, "out")
        self.assertEqual(sync.main(["--source", self.src, "--out", out, "--updated", "d"]), 0)
        self.assertTrue(os.path.isfile(os.path.join(out, "my-progress.json")))
        self.assertTrue(os.path.isfile(os.path.join(out, "solutions.json")))


if __name__ == "__main__":
    unittest.main()
