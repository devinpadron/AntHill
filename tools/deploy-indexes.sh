#!/usr/bin/env bash
#
# Deploys Firestore indexes.
#
#   ./tools/deploy-indexes.sh [--database=test]
#
# WHY THIS SCRIPT EXISTS
#
# firebase.json uses the ARRAY form of the `firestore` config so that a rules
# deploy targets BOTH the default and test databases in one command. That form
# crashes the CLI when an `indexes` key is present:
#
#     TypeError: Cannot read properties of undefined (reading 'map')
#
# (firebase-tools 14.4.0). The single-object form deploys indexes fine, but
# ignores `database` and always targets (default).
#
# So: firebase.json carries rules only, and this script swaps in a temporary
# single-object config to deploy indexes, then restores it. Verified against
# production on 2026-08-04 — all 5 v1 indexes survived and 18 v2 indexes were
# created.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

PROJECT="anthill-51de0"
BACKUP="$(mktemp)"
cp firebase.json "$BACKUP"
restore() { cp "$BACKUP" firebase.json; rm -f "$BACKUP"; }
trap restore EXIT

python3 - <<'PY'
import json
config = json.load(open("firebase.json"))
config["firestore"] = {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json",
}
json.dump(config, open("firebase.json", "w"), indent="\t")
PY

echo "Deploying indexes from firestore.indexes.json to (default)..."
firebase deploy --only firestore:indexes --project "$PROJECT"

cat <<'NOTE'

NOTE: this deployed to the (default) database only. The CLI cannot target the
`test` database for indexes. To index `test`, run:

    cd tools/migration && node src/check-queries.mjs --db=test

and open the console URLs it prints for any shape reporting a missing index.
NOTE
