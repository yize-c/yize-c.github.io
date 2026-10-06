# sql.js (vendored)

The SQL playground in the Learner Space runs SQLite in the browser with
[sql.js](https://github.com/sql-js/sql.js). The files are saved here instead of
loaded from a CDN, so the site does not depend on another server and the
Content-Security-Policy can stay `script-src 'self'`.

| | |
|---|---|
| Version | **1.14.2** |
| Downloaded from | npm: `https://registry.npmjs.org/sql.js/-/sql.js-1.14.2.tgz` (files from its `dist/` folder) |
| Package integrity (from the npm registry) | `sha512-3ZGPovObMFrdw79zrUHbfdE/DLIsy8jdNdssmMSQuRAymedU6q84asPt0kgiqrdMYlPegDItiIMfmIXzZnYFcw==` |
| License | MIT, see [`LICENSE`](LICENSE) (copied unchanged from the package) |

## Files and SHA-256 checksums

| File | What it is | SHA-256 |
|---|---|---|
| `sql-wasm.js` | JavaScript loader (`initSqlJs`) | `f1c84000dbc856c9d87f4f3aabc4d3654bd436165db4be3da13751db3a9c20d7` |
| `sql-wasm.wasm` | SQLite compiled to WebAssembly | `38c14f6e379210bc942bdc4ebca44e7bfdb4318ecc1c72ca666a28fdce96670a` |
| `LICENSE` | MIT license | `60a3f6e4d7b29b4321359e683b36cf198d24f58e24582070f56e6fa89d5ee2be` |

The same checksums are in [`SHA256SUMS`](SHA256SUMS). CI runs
`sha256sum --check --strict SHA256SUMS` in this folder, so any change to these files,
on purpose or by accident, fails the build until the checksums are updated too.

## Updating to a new version

```bash
npm pack sql.js@NEW_VERSION
tar xzf sql.js-NEW_VERSION.tgz
cp package/dist/sql-wasm.js package/dist/sql-wasm.wasm package/LICENSE vendor/sql.js/
cd vendor/sql.js && sha256sum sql-wasm.js sql-wasm.wasm LICENSE > SHA256SUMS
```

Then update the version, integrity and checksums in this README, run `node --test`
(it runs every SQL exercise with this copy of sql.js), and try the playground in a browser.
