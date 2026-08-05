#!/usr/bin/env bash
#
# Deploys Firestore rules to BOTH databases.
#
#   ./tools/deploy-firestore.sh
#
# WHY THIS SCRIPT EXISTS
#
# firebase.json uses the ARRAY form of the `firestore` config so that one
# command covers the (default) and `test` databases. With that form:
#
#   firebase deploy --only firestore:rules   -> SILENTLY DEPLOYS NOTHING.
#                                               No compile step, no release,
#                                               and still prints "Deploy
#                                               complete!". This cost us a live
#                                               debugging session: the v2 rules
#                                               appeared deployed for hours
#                                               while every v2 read was denied.
#
#   firebase deploy --only firestore         -> correct. Compiles once and
#                                               prints one "released rules"
#                                               line PER DATABASE.
#
# Verified on firebase-tools 14.4.0.
#
# ALWAYS check the output for one "released rules" line per database. If you
# see none, nothing was deployed.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

PROJECT="anthill-51de0"

echo "Deploying firestore rules to all databases in $PROJECT..."
output=$(firebase deploy --only firestore --project "$PROJECT" 2>&1)
echo "$output"

released=$(grep -c "released rules" <<<"$output" || true)
echo
if [ "$released" -lt 2 ]; then
	echo "FAILED: expected 2 'released rules' lines (default + test), saw $released."
	echo "Nothing may have been deployed. Do not assume the rules are live."
	exit 1
fi

echo "OK: rules released to $released databases."
