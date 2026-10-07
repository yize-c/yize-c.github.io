#!/usr/bin/env bash
# Builds _site/, the folder that gets deployed:
#   1. copies only the files visitors need (tests, scripts, partials, README, CI config stay private);
#   2. adds a version to every local CSS/JS link (tokens.css -> tokens.css?v=<hash of the file>),
#      so browsers fetch a file again exactly when it changed. The source HTML has no versions.
# The Learner Space data (data/*.json, data/concepts/) is added afterwards by
# scripts/sync_interview_prep.py --out _site/data.
# Usage: bash scripts/build_site.sh   (run from the repository root)
set -euo pipefail

OUT="_site"
PUBLIC=(index.html learn.html 404.html .nojekyll css js assets projects vendor)

rm -rf "$OUT"
mkdir -p "$OUT/data"
for item in "${PUBLIC[@]}"; do
  cp -R "$item" "$OUT/"
done
cp data/bash-cheatsheet.json "$OUT/data/"   # data/library/ is only read by the sync script

python3 - "$OUT" <<'PY'
import hashlib, pathlib, re, sys
out = pathlib.Path(sys.argv[1])
ref = re.compile(r'((?:href|src)=")([^"?#]+\.(?:css|js))(")')
for page in out.rglob("*.html"):
    html = page.read_text(encoding="utf-8")
    def version(m):
        path = m.group(2)
        if path.startswith(("http:", "https:", "//")):
            return m.group(0)
        file = (out / path.lstrip("/")) if path.startswith("/") else (page.parent / path)
        digest = hashlib.sha256(file.read_bytes()).hexdigest()[:10]  # fails loudly if a link is broken
        return "%s%s?v=%s%s" % (m.group(1), path, digest, m.group(3))
    page.write_text(ref.sub(version, html), encoding="utf-8")
PY

# Safety check: nothing private may end up in the deployed folder.
for private in tests scripts partials README.md CONTRIBUTING.md CLAUDE.md .github data/library pyproject.toml requirements-dev.txt; do
  if [ -e "$OUT/$private" ]; then
    echo "Private file or folder in $OUT: $private" >&2
    exit 1
  fi
done
echo "Built $OUT/ with: ${PUBLIC[*]} data/bash-cheatsheet.json (CSS/JS links versioned by content hash)"
