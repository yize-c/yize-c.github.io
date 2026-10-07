#!/usr/bin/env bash
# Copies only the files visitors need into _site/, which is what gets deployed.
# Everything else (tests, scripts, partials, README, CI config) stays private to the repo.
# Usage: bash scripts/build_site.sh   (run from the repository root)
set -euo pipefail

OUT="_site"
PUBLIC=(index.html learn.html 404.html .nojekyll css js assets data projects vendor)

rm -rf "$OUT"
mkdir -p "$OUT"
for item in "${PUBLIC[@]}"; do
  cp -R "$item" "$OUT/"
done

# Safety check: nothing private may end up in the deployed folder.
for private in tests scripts partials README.md .github; do
  if [ -e "$OUT/$private" ]; then
    echo "Private file or folder in $OUT: $private" >&2
    exit 1
  fi
done
echo "Built $OUT/ with: ${PUBLIC[*]}"
