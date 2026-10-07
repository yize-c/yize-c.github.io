#!/usr/bin/env python3
"""Build the Learner Space data from my interview-prep repo.

The README of https://github.com/yize-c/interview-prep is the single source of truth:
it decides which practice items exist, their order and sections, and whether
each one is done. This repo only keeps the extra details (hints, notes,
flashcards, SQL exercises) in data/library/, looked up by the README line.

    python3 scripts/sync_interview_prep.py --source ../interview-prep --out data

Writes, in the format js/learn.js reads:
    leetcode.json, go.json, sql-exercises.json, concepts/<area>.json,
    my-progress.json, solutions.json

How README lines find their details in data/library/:
    LeetCode problems and Go re-solves   by problem number ("1. Two Sum")
    everything else                      by the exact README line text
                                         (the "readme" field of a library entry)
A README item with no details still appears, as "notes coming soon". Library
entries the README no longer lists are skipped (and reported). A SQL playground
exercise can't exist without its details (it needs a solution), so that is an error.

Status of each item:
    [x] in the README                       -> "Done"
    not ticked, but a solution file exists  -> "In progress"
    otherwise                               -> "Not started"

The other repo is only ever treated as data: known shapes only, symlinks skipped,
embedded code capped at 20 KB, and the site shows everything as text.
Standard library only.
"""
import argparse
import datetime
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIBRARY = os.path.join(ROOT, "data", "library")
REPO_URL = "https://github.com/yize-c/interview-prep/blob/main/"
MAX_CODE_BYTES = 20000
COMING_SOON = "Notes coming soon."

CHECKBOX = re.compile(r"^\s*[-*]\s+\[([ xX])\]\s+(.*\S)\s*$")
SECTION = re.compile(r"^##\s+\d+\.\s+(.*\S)\s*$")
SUBSECTION = re.compile(r"^###\s+(.*\S)\s*$")
NUMBERED = re.compile(r"^(\d+)\.\s+(.*\S)$")
SOLUTION_FILE = re.compile(r"^(\d{1,4})_[A-Za-z0-9_\-]+\.(py|sql|sh|go)$")
LANGUAGES = {"py": "python", "sql": "sql", "sh": "bash", "go": "go"}
SOLUTION_DIRS = {"leetcode": "lc-", "sql": "lc-sql-", "bash": "lc-bash-", "go": "go-lc-"}

# README section heading (first matching word wins, so "playground" before "sql").
SECTIONS = [("playground", "playground"), ("coding", "coding"), ("sql", "sql"), ("bash", "bash"),
            ("go", "go"), ("networking", "networking"), ("linux", "linux"),
            ("testing", "testing"), ("devops", "devops"), ("security", "security")]
AREAS = ["networking", "linux", "testing", "devops", "security"]


class SyncError(Exception):
    pass


def load_library(rel):
    with open(os.path.join(LIBRARY, rel), encoding="utf-8") as f:
        return json.load(f)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def parse_readme(text):
    """{section: [(ticked, label, subsection), ...]} in README order."""
    found, kind, sub = {}, None, None
    for line in text.splitlines():
        s = SECTION.match(line)
        if s:
            title = s.group(1).lower()
            kind = next((k for word, k in SECTIONS if word in title), None)
            sub = None
            continue
        h = SUBSECTION.match(line)
        if h:
            sub = h.group(1)
            continue
        c = CHECKBOX.match(line)
        if c and kind:
            found.setdefault(kind, []).append((c.group(1) in "xX", c.group(2), sub))
    return found


def numbered(label, where):
    m = NUMBERED.match(label)
    if not m:
        raise SyncError("%s line without a problem number: %r" % (where, label))
    return int(m.group(1)), m.group(2)


class Builder:
    """Walks the README sections and builds each Learner Space file."""

    def __init__(self, sections):
        self.sections = sections
        self.ticked = {}      # id -> README tick
        self.unused = []      # library entries the README doesn't list

    def item(self, item_id, done):
        if item_id in self.ticked:
            raise SyncError("The README lists %s twice" % item_id)
        self.ticked[item_id] = done

    def report_unused(self, where, entries, used):
        self.unused += ["%s: %s" % (where, e["id"]) for e in entries if e["id"] not in used]

    # ---------- LeetCode (Coding, SQL, Bash): matched by problem number ----------
    def leetcode_list(self, kind, prefix, library, category_default):
        by_number = {p["number"]: p for p in library["problems"]}
        problems, categories, used = [], [], set()
        for done, label, sub in self.sections.get(kind, []):
            number, title = numbered(label, kind)
            detail = by_number.get(number)
            category = sub or category_default
            if detail:
                used.add(detail["id"])
                p = dict(detail, title=title, category=category)
            else:
                p = {"id": prefix + str(number), "number": number, "title": title,
                     "url": "https://leetcode.com/problems/%s/" % slug(title),
                     "difficulty": "Unrated", "category": category,
                     "keyIdea": COMING_SOON, "hint": COMING_SOON}
            self.item(p["id"], done)
            problems.append(p)
            if category not in categories:
                categories.append(category)
        self.report_unused("leetcode " + kind, library["problems"], used)
        return problems, categories

    def leetcode(self):
        lib = load_library("leetcode.json")
        coding, categories = self.leetcode_list("coding", "lc-", lib["coding"], "Other")
        sql, _ = self.leetcode_list("sql", "lc-sql-", lib["sql"], "SQL")
        bash, _ = self.leetcode_list("bash", "lc-bash-", lib["bash"], "Bash")
        return {"_about": lib.get("_about", ""), "coding": {"categories": categories, "problems": coding},
                "sql": {"problems": sql}, "bash": {"problems": bash}}

    # ---------- Go: basics and tools by text, re-solves by number ----------
    def go(self):
        lib = load_library("go.json")
        by_text = {i["readme"]: i for key in ("basics", "tools") for i in lib[key]}
        by_number = {i["number"]: i for i in lib["resolve"]}
        out = {"why": lib["why"], "basics": [], "resolve": [], "tools": []}
        used = set()
        for done, label, sub in self.sections.get("go", []):
            group = "resolve" if sub and "solve" in sub.lower() else "tools" if sub and "tool" in sub.lower() else "basics"
            if group == "resolve":
                number, title = numbered(label, "go re-solve")
                detail = by_number.get(number)
                item = dict(detail, title=title) if detail else {
                    "id": "go-lc-%d" % number, "number": number, "title": title,
                    "url": "https://leetcode.com/problems/%s/" % slug(title), "note": COMING_SOON}
            else:
                detail = by_text.get(label)
                item = dict(detail) if detail else {"id": "go-%s-%s" % (group, slug(label)), "title": label,
                                                    "note": COMING_SOON, "readme": label}
            if detail:
                used.add(detail["id"])
            self.item(item["id"], done)
            out[group].append(item)
        self.report_unused("go", lib["basics"] + lib["resolve"] + lib["tools"], used)
        return out

    # ---------- Concept flashcards: by text ----------
    def concepts(self, area):
        lib = load_library("concepts/%s.json" % area)
        by_text = {c["readme"]: c for c in lib["cards"]}
        prefix = lib["cards"][0]["id"].split("-")[0] if lib["cards"] else area
        cards, used = [], set()
        for done, label, _sub in self.sections.get(area, []):
            card = by_text.get(label)
            if card:
                used.add(card["id"])
            else:
                card = {"id": "%s-%s" % (prefix, slug(label)), "topic": label, "question": label,
                        "hint": "", "answer": COMING_SOON, "explanation": "", "readme": label}
            self.item(card["id"], done)
            cards.append(card)
        self.report_unused("concepts " + area, lib["cards"], used)
        return {"area": lib["area"], "title": lib["title"], "cards": cards}

    # ---------- SQL playground: by text, details required ----------
    def sql_playground(self):
        lib = load_library("sql-exercises.json")
        by_text = {e["readme"]: e for e in lib["exercises"]}
        exercises = []
        for done, label, _sub in self.sections.get("playground", []):
            ex = by_text.get(label)
            if not ex:
                raise SyncError("SQL playground item %r has no exercise in data/library/sql-exercises.json "
                                "(the line must match an exercise's \"readme\" text exactly)" % label)
            self.item(ex["id"], done)
            exercises.append(ex)
        self.report_unused("sql playground", lib["exercises"], {e["id"] for e in exercises})
        return {"_about": lib.get("_about", ""), "setup": lib["setup"], "exercises": exercises}


def find_solutions(source):
    """Solution files like leetcode/0001_two_sum.py -> {"lc-1": {...}}."""
    solutions = {}
    for folder, prefix in SOLUTION_DIRS.items():
        path = os.path.join(source, folder)
        if not os.path.isdir(path):
            continue
        for name in sorted(os.listdir(path)):
            m = SOLUTION_FILE.match(name)
            full = os.path.join(path, name)
            if not m or not os.path.isfile(full) or os.path.islink(full):
                continue
            entry = {"language": LANGUAGES[m.group(2)], "url": REPO_URL + folder + "/" + name}
            if os.path.getsize(full) <= MAX_CODE_BYTES:
                with open(full, encoding="utf-8", errors="replace") as f:
                    entry["code"] = f.read().rstrip("\n")
            solutions[prefix + str(int(m.group(1)))] = entry
    return solutions


def build(source, updated):
    """Return {relative output path: data} plus the list of skipped library entries."""
    with open(os.path.join(source, "README.md"), encoding="utf-8") as f:
        sections = parse_readme(f.read())
    missing = [k for _w, k in SECTIONS if k not in sections]
    if missing:
        raise SyncError("README.md has no items in these sections: %s. Every section must exist "
                        "(an empty one would silently empty that part of the Learner Space)." % ", ".join(missing))
    b = Builder(sections)
    files = {
        "leetcode.json": b.leetcode(),
        "go.json": b.go(),
        "sql-exercises.json": b.sql_playground(),
    }
    for area in AREAS:
        files["concepts/%s.json" % area] = b.concepts(area)

    solutions = find_solutions(source)
    unknown = sorted(set(solutions) - set(b.ticked))
    if unknown:
        raise SyncError("Solution files for items the README doesn't list: " + ", ".join(unknown))
    files["my-progress.json"] = {
        "_about": "Generated from github.com/yize-c/interview-prep by scripts/sync_interview_prep.py.",
        "updated": updated,
        "items": {i: "Done" if done else "In progress" if i in solutions else "Not started"
                  for i, done in b.ticked.items()},
    }
    files["solutions.json"] = {"solutions": solutions}
    return files, b.unused


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--source", required=True, help="checkout of yize-c/interview-prep")
    ap.add_argument("--out", required=True, help="folder to write the Learner Space data into (e.g. data or _site/data)")
    ap.add_argument("--updated", default=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
                    help="date shown as 'updated' (default: today, UTC)")
    args = ap.parse_args(argv)
    try:
        files, unused = build(args.source, args.updated)
    except (SyncError, OSError, KeyError, ValueError) as e:
        print("interview-prep sync failed: %s" % e, file=sys.stderr)
        return 1
    for rel, data in files.items():
        path = os.path.join(args.out, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
    for u in unused:
        print("note: not in the README, so not shown: " + u)
    items = files["my-progress.json"]["items"]
    counts = {}
    for s in items.values():
        counts[s] = counts.get(s, 0) + 1
    print("Built %d items (%s) and %d solutions into %s" % (
        len(items), ", ".join("%s: %d" % kv for kv in sorted(counts.items())),
        len(files["solutions.json"]["solutions"]), args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
