#!/usr/bin/env python3
"""Turn my interview-prep repo into the Learner Space's "Me" data.

Source: https://github.com/yize-c/interview-prep (a checklist README plus solution files).
Output: my-progress.json and solutions.json, in the format js/learn.js reads.
Items the README doesn't cover (the site's own SQL playground) keep their values
from the hand-edited data/my-progress.json and data/solutions.json.

    python3 scripts/sync_interview_prep.py --source ../interview-prep --out _site/data

Status of each item:
    [x] in the README                       -> "Done"
    not ticked, but a solution file exists  -> "In progress"
    otherwise                               -> "Not started"

Matching README lines to the site's ids:
    LeetCode problems                      by problem number: "1. Two Sum" -> lc-1,
                                           SQL "175. ..." -> lc-sql-175, Bash "195. ..." -> lc-bash-195
    Go and the five concept sections       by order, and the number of items in
                                           each section must match the site's data.
Anything that doesn't match stops the script with an error, so CI fails loudly
instead of showing the wrong progress. The other repo's content is only ever
treated as data: known ids only, size limits, and the site shows code as text.

Standard library only.
"""
import argparse
import datetime
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_URL = "https://github.com/yize-c/interview-prep/blob/main/"
MAX_CODE_BYTES = 20000

CHECKBOX = re.compile(r"^\s*[-*]\s+\[([ xX])\]\s+(.*\S)\s*$")
HEADING = re.compile(r"^##\s+\d+\.\s+(.*\S)\s*$")
LEETCODE = re.compile(r"^(\d+)\.\s")
SOLUTION_FILE = re.compile(r"^(\d{1,4})_[A-Za-z0-9_\-]+\.(py|sql|sh|go)$")
LANGUAGES = {"py": "python", "sql": "sql", "sh": "bash", "go": "go"}
SOLUTION_DIRS = {"leetcode": "lc-", "sql": "lc-sql-", "bash": "lc-bash-", "go": "go-lc-"}

# README section (matched by a word in its heading) -> how to name its items.
SECTIONS = [
    ("coding", "leetcode:lc-"), ("sql", "leetcode:lc-sql-"), ("bash", "leetcode:lc-bash-"),
    ("go", "go"),
    ("networking", "concepts:networking"), ("linux", "concepts:linux"),
    ("testing", "concepts:testing"), ("devops", "concepts:devops"),
    ("security", "concepts:security"),
]


class SyncError(Exception):
    pass


def load(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        return json.load(f)


def site_ids():
    """The ids the site knows about, grouped the way the README is."""
    lc = load("data/leetcode.json")
    go = load("data/go.json")
    leetcode = set()
    for key in ("coding", "sql", "bash"):
        leetcode.update(p["id"] for p in lc[key]["problems"])
    groups = {"go": [i["id"] for key in ("basics", "resolve", "tools") for i in go[key]]}
    for area in ("networking", "linux", "testing", "devops", "security"):
        groups["concepts:" + area] = [c["id"] for c in load("data/concepts/%s.json" % area)["cards"]]
    return leetcode, groups


def parse_readme(text):
    """Return {section kind: [(ticked, label), ...]} in README order."""
    found, kind = {}, None
    for line in text.splitlines():
        h = HEADING.match(line)
        if h:
            title = h.group(1).lower()
            kind = next((k for word, k in SECTIONS if word in title), None)
            continue
        c = CHECKBOX.match(line)
        if c and kind:
            found.setdefault(kind, []).append((c.group(1) in "xX", c.group(2)))
    return found


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
            item_id = prefix + str(int(m.group(1)))
            entry = {"language": LANGUAGES[m.group(2)], "url": REPO_URL + folder + "/" + name}
            if os.path.getsize(full) <= MAX_CODE_BYTES:
                with open(full, encoding="utf-8", errors="replace") as f:
                    entry["code"] = f.read().rstrip("\n")
            solutions[item_id] = entry
    return solutions


def build(source, updated):
    with open(os.path.join(source, "README.md"), encoding="utf-8") as f:
        sections = parse_readme(f.read())
    leetcode, groups = site_ids()
    solutions = find_solutions(source)

    ticked = {}
    for kind, items in sections.items():
        if kind.startswith("leetcode:"):
            prefix = kind.split(":", 1)[1]
            for done, label in items:
                m = LEETCODE.match(label)
                if not m:
                    raise SyncError("LeetCode line without a problem number: %r" % label)
                item_id = prefix + m.group(1)
                if item_id not in leetcode:
                    raise SyncError("README has %s, but data/leetcode.json doesn't. Add it there too." % item_id)
                ticked[item_id] = done
        else:
            ids = groups[kind]
            if len(items) != len(ids):
                raise SyncError("README section %r has %d items, the site has %d. Add or remove the item on both sides."
                                % (kind, len(items), len(ids)))
            for item_id, (done, _label) in zip(ids, items):
                ticked[item_id] = done
    if not ticked:
        raise SyncError("No checklist items found in README.md")

    unknown = sorted(set(solutions) - set(ticked))
    if unknown:
        raise SyncError("Solution files for items the README doesn't list: " + ", ".join(unknown))

    # Items the README doesn't cover (the site's own SQL playground exercises)
    # keep the value written by hand in data/my-progress.json.
    items = {k: v for k, v in load("data/my-progress.json").get("items", {}).items() if k not in ticked}
    for item_id, done in ticked.items():
        items[item_id] = "Done" if done else "In progress" if item_id in solutions else "Not started"
    progress = {
        "_about": "Generated from github.com/yize-c/interview-prep by scripts/sync_interview_prep.py. Do not edit by hand.",
        "updated": updated,
        "items": items,
    }
    merged = dict(load("data/solutions.json").get("solutions", {}))
    merged.update(solutions)  # a file in interview-prep wins over a hand-written entry
    return progress, {"solutions": merged}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--source", required=True, help="checkout of yize-c/interview-prep")
    ap.add_argument("--out", required=True, help="folder to write my-progress.json and solutions.json into")
    ap.add_argument("--updated", default=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
                    help="date shown as 'updated' (default: today, UTC)")
    args = ap.parse_args(argv)
    try:
        progress, solutions = build(args.source, args.updated)
    except (SyncError, OSError, KeyError, ValueError) as e:
        print("interview-prep sync failed: %s" % e, file=sys.stderr)
        return 1
    os.makedirs(args.out, exist_ok=True)
    for name, data in (("my-progress.json", progress), ("solutions.json", solutions)):
        with open(os.path.join(args.out, name), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
    counts = {}
    for s in progress["items"].values():
        counts[s] = counts.get(s, 0) + 1
    print("Synced %d items (%s) and %d solutions into %s" % (
        len(progress["items"]), ", ".join("%s: %d" % kv for kv in sorted(counts.items())),
        len(solutions["solutions"]), args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
