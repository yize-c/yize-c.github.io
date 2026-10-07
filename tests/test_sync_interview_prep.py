"""Tests for scripts/sync_interview_prep.py (run: python3 -m unittest discover -s tests).

Each test writes a fake interview-prep README (built from the real data/library/,
so the details exist) into a temporary folder and builds the Learner Space data."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
import sync_interview_prep as sync  # noqa: E402

LC = sync.load_library("leetcode.json")
GO = sync.load_library("go.json")
SQL = sync.load_library("sql-exercises.json")
CARDS = {a: sync.load_library("concepts/%s.json" % a)["cards"] for a in sync.AREAS}
TITLES = {"networking": "5. Networking concepts", "linux": "6. Linux & OS concepts",
          "testing": "7. Testing / QA concepts", "devops": "8. DevOps concepts", "security": "9. Security concepts"}


def box(label, ticked):
    return "- [%s] %s" % ("x" if label in ticked else " ", label)


def readme(ticked=(), extra=None, drop=(), reverse_coding=False):
    """A README shaped like the real one, listing every library entry.
    `extra` adds lines to a section; `drop` removes lines; `ticked` marks labels [x]."""
    extra = extra or {}
    out = ["# interview-prep", "", "## 1. Coding (Python)"]
    problems = LC["coding"]["problems"][::-1] if reverse_coding else LC["coding"]["problems"]
    for cat in LC["coding"]["categories"]:
        out += ["", "### " + cat]
        out += [box("%d. %s" % (p["number"], p["title"]), ticked) for p in problems if p["category"] == cat]
    out += extra.get("coding", [])
    for n, (name, key) in enumerate((("SQL", "sql"), ("Bash", "bash")), 2):
        out += ["", "## %d. %s" % (n, name)] + [box("%d. %s" % (p["number"], p["title"]), ticked) for p in LC[key]["problems"]]
    out += ["", "## 4. Go", "### Basics"] + [box(i["readme"], ticked) for i in GO["basics"]]
    out += ["### Re-solve in Go"] + [box("%d. %s" % (i["number"], i["title"]), ticked) for i in GO["resolve"]]
    out += ["### Small tools"] + [box(i["readme"], ticked) for i in GO["tools"]]
    for area in sync.AREAS:
        out += ["", "## " + TITLES[area]] + [box(c["readme"], ticked) for c in CARDS[area]] + extra.get(area, [])
    out += ["", "## 10. SQL playground"] + [box(e["readme"], ticked) for e in SQL["exercises"]] + extra.get("playground", [])
    return "\n".join(line for line in out if line not in drop) + "\n"


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

    def build(self, text):
        self.write("README.md", text)
        return sync.build(self.src, "2026-10-07")

    def test_full_readme_rebuilds_every_list(self):
        files, unused = self.build(readme())
        self.assertEqual(unused, [])
        self.assertEqual(len(files["leetcode.json"]["coding"]["problems"]), len(LC["coding"]["problems"]))
        self.assertEqual(files["leetcode.json"]["coding"]["categories"], LC["coding"]["categories"])
        self.assertEqual(len(files["sql-exercises.json"]["exercises"]), len(SQL["exercises"]))
        self.assertEqual(len(files["go.json"]["tools"]), len(GO["tools"]))
        self.assertEqual(files["concepts/security.json"]["cards"], CARDS["security"])
        self.assertTrue(all(s == "Not started" for s in files["my-progress.json"]["items"].values()))

    def test_status_from_checkbox_and_solution_files(self):
        first_card = CARDS["networking"][0]["readme"]
        files, _ = self.build(readme(ticked={"1. Two Sum", first_card, SQL["exercises"][0]["readme"]}))
        self.write("leetcode/0217_contains_duplicate.py", "pass\n")
        files, _ = sync.build(self.src, "d")
        items = files["my-progress.json"]["items"]
        self.assertEqual(items["lc-1"], "Done")
        self.assertEqual(items["lc-217"], "In progress")
        self.assertEqual(items["sql-01"], "Done")
        self.assertEqual(items[CARDS["networking"][0]["id"]], "Done")
        self.assertEqual(items["lc-242"], "Not started")

    def test_readme_order_wins(self):
        files, _ = self.build(readme(reverse_coding=True))
        cat = LC["coding"]["categories"][0]
        lib_order = [p["id"] for p in LC["coding"]["problems"] if p["category"] == cat]
        out_order = [p["id"] for p in files["leetcode.json"]["coding"]["problems"] if p["category"] == cat]
        self.assertEqual(out_order, lib_order[::-1])

    def test_new_items_without_details_still_show(self):
        files, _ = self.build(readme(extra={"coding": ["- [ ] 42. Trapping Rain Water"],
                                            "security": ["- [ ] Zero trust in one sentence"]}))
        p = files["leetcode.json"]["coding"]["problems"][-1]
        self.assertEqual((p["id"], p["title"], p["difficulty"]), ("lc-42", "Trapping Rain Water", "Unrated"))
        self.assertEqual(p["url"], "https://leetcode.com/problems/trapping-rain-water/")
        card = files["concepts/security.json"]["cards"][-1]
        self.assertEqual(card["question"], "Zero trust in one sentence")
        self.assertEqual(card["answer"], sync.COMING_SOON)
        self.assertIn(card["id"], files["my-progress.json"]["items"])

    def test_items_removed_from_readme_disappear(self):
        gone = CARDS["devops"][0]
        files, unused = self.build(readme(drop={box(gone["readme"], ())}))
        self.assertNotIn(gone["id"], [c["id"] for c in files["concepts/devops.json"]["cards"]])
        self.assertIn("concepts devops: " + gone["id"], unused)

    def test_playground_line_without_exercise_fails(self):
        with self.assertRaisesRegex(sync.SyncError, "SQL playground"):
            self.build(readme(extra={"playground": ["- [ ] 31. Something new"]}))

    def test_missing_section_fails(self):
        text = readme().split("## 10. SQL playground")[0]
        with self.assertRaisesRegex(sync.SyncError, "playground"):
            self.build(text)

    def test_duplicate_item_fails(self):
        with self.assertRaisesRegex(sync.SyncError, "twice"):
            self.build(readme(extra={"coding": ["- [ ] 1. Two Sum"]}))

    def test_solution_for_unlisted_item_fails(self):
        self.write("leetcode/0042_trapping_rain_water.py", "pass\n")
        with self.assertRaisesRegex(sync.SyncError, "lc-42"):
            self.build(readme())

    def test_solution_code_link_size_limit_and_symlinks(self):
        self.write("sql/0175_combine_two_tables.sql", "SELECT 1;\n")
        self.write("bash/0195_tenth_line.sh", "x" * (sync.MAX_CODE_BYTES + 1))
        target = self.write("secret.txt", "do not publish")
        os.makedirs(os.path.join(self.src, "leetcode"), exist_ok=True)
        os.symlink(target, os.path.join(self.src, "leetcode", "0001_two_sum.py"))
        sols = self.build(readme())[0]["solutions.json"]["solutions"]
        self.assertEqual(sols["lc-sql-175"]["code"], "SELECT 1;")
        self.assertEqual(sols["lc-sql-175"]["url"], sync.REPO_URL + "sql/0175_combine_two_tables.sql")
        self.assertNotIn("code", sols["lc-bash-195"])
        self.assertNotIn("lc-1", sols)

    def test_main_writes_every_file(self):
        self.write("README.md", readme())
        out = os.path.join(self.src, "out")
        self.assertEqual(sync.main(["--source", self.src, "--out", out, "--updated", "d"]), 0)
        for rel in ["leetcode.json", "go.json", "sql-exercises.json", "concepts/linux.json",
                    "my-progress.json", "solutions.json"]:
            self.assertTrue(os.path.isfile(os.path.join(out, rel)), rel)


if __name__ == "__main__":
    unittest.main()
