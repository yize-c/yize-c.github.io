# yize-c.github.io

My personal portfolio site: <https://yize-c.github.io/>

It has three parts:

- **Main page** (`index.html`): about me, projects, experience, education, skills, journey, certificate goals, and contact.
- **Project explainers** (`projects/*.html`): one page per project, with a plain-language summary, a small in-browser demo that uses made-up data, what I learned, and a mini glossary.
- **Learner Space** (`learn.html`): my co-op interview prep (coding, SQL, Bash, Go, concepts), open for anyone to practice with.

Plain HTML, CSS, and JavaScript. No framework, no build step, no trackers or analytics.

## Run it locally

The Learner Space loads JSON files with `fetch`, which browsers block for `file://` pages, so use a small local server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Folder layout

```
index.html            main page
404.html              "page not found" page (uses root-absolute links, since it can be served at any path)
learn.html            Learner Space
projects/             one explainer page per project
css/style.css         all styles (light and dark themes)
js/                   theme toggle, demos, Learner Space, SQL playground
data/                 practice lists and questions (JSON)
assets/img/           favicon and app icons (from the duck picture)
vendor/sql.js/        sql.js 1.14.2 (SQLite in WebAssembly), saved locally, MIT license
```

## Updating my progress

Edit `data/my-progress.json`. Every practice item has an id. Set its value to `"Not started"`, `"In progress"`, or `"Done"`, and update the `"updated"` date (any text, for example `"2026-11-01"`). Missing ids count as "Not started".

```json
{ "updated": "2026-11-01", "items": { "lc-1": "Done", "lc-217": "In progress" } }
```

Visitors' own checkboxes are separate. They are saved only in their browser (`localStorage`).

## Adding my own solutions

Add entries to `data/solutions.json`, keyed by problem id. Until an entry exists, the problem shows "Coming soon".

```json
{
  "solutions": {
    "lc-1": { "language": "python", "code": "def two_sum(nums, target):\n    ...", "url": "https://github.com/yize-c/..." }
  }
}
```

`code` and `url` are both optional; use either or both.

## Adding practice questions

All lists live in `data/`. Ids must be unique, because progress is stored by id.

**LeetCode problems** (`data/leetcode.json`): add to `coding.problems`, `sql.problems`, or `bash.problems`. Only link to the problem; never copy its statement.

```json
{
  "id": "lc-128", "number": 128, "title": "Longest Consecutive Sequence",
  "url": "https://leetcode.com/problems/longest-consecutive-sequence/",
  "difficulty": "Medium", "category": "Arrays & Hashing",
  "keyIdea": "Hash set", "hint": "My own one- or two-sentence hint."
}
```

For coding problems, `category` must be one of the names in `coding.categories` (add a new name there to create a new group). Use the prefix `lc-` for coding, `lc-sql-` for SQL, and `lc-bash-` for Bash.

**Concept flashcards** (`data/concepts/<area>.json`, areas: networking, linux, testing, devops, security): add to `cards`. The `quiz` part is used by the Quiz mode; `answer` is the index (starting at 0) of the correct option.

```json
{
  "id": "net-example", "topic": "Topic name from my checklist",
  "question": "…", "hint": "…", "answer": "Short answer.", "explanation": "Plain-language explanation for beginners.",
  "quiz": { "question": "…", "options": ["A", "B", "C", "D"], "answer": 1, "why": "Why B is right." }
}
```

**SQL playground exercises** (`data/sql-exercises.json`): `setup` holds the SQL that builds the sample database (students, courses, enrollments). Each exercise:

```json
{
  "id": "sql-31", "topic": "Subqueries", "difficulty": "Medium",
  "question": "Plain-English question.", "tables": ["students", "enrollments"],
  "hint": "…", "solution": "SELECT …;", "ordered": false
}
```

The expected result is whatever `solution` returns on a fresh copy of the sample data, so you never write the expected rows by hand. Set `ordered` to `true` only when the question asks for a specific order and the ORDER BY has no ties.

**Go** (`data/go.json`) has `basics`, `resolve`, and `tools` lists; **Bash cheat sheet** is `data/bash-cheatsheet.json`.

After adding ids, also add them to `data/my-progress.json` (optional, since missing ids count as "Not started").

## Updating CSS or JavaScript

Pages load `css/` and `js/` files with a version number, like `style.css?v=2026100601`, so browsers fetch new files after an update instead of using old cached ones. When you change a CSS or JS file, change that number everywhere it appears (a find-and-replace across the `.html` files is enough).

## Deployment

GitHub Pages uses **GitHub Actions** as its source. `.github/workflows/deploy-pages.yml` publishes the site every time `main` changes (you can also run it by hand from the Actions tab).

## CI checks

`.github/workflows/site-checks.yml` runs on every pull request and every push to `main` (you can also run it by hand from the Actions tab):

1. **HTML validation** with [html-validate](https://html-validate.org/) (rules in `.htmlvalidate.json`).
2. **JSON check**: every file in `data/` must parse.
3. **Link checker** with [lychee](https://lychee.cli.rs/) (settings in `lychee.toml`). It checks internal and external links in every HTML page.

To run the HTML check locally: `npx html-validate "*.html" "projects/*.html"`.

## Security notes

Each page has a strict Content-Security-Policy `<meta>` tag: scripts, styles, and data only from this site, no inline scripts or styles. `learn.html` also allows `'wasm-unsafe-eval'`, which sql.js needs to run WebAssembly. External links open in a new tab with `rel="noopener noreferrer"`.
