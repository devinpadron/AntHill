#!/usr/bin/env bash
#
# Enforces screen -> hook -> service -> db, plus a few Firestore API footguns
# that TypeScript cannot see while documents are still typed `any`.
#
# Runs in the husky pre-commit hook and in CI. No dependencies beyond git.
#
# Every rule below uses plain `find`, NOT `git grep`. git grep silently skips
# UNTRACKED files, so a brand new file could violate a rule on the very commit
# that introduces it — the exact moment the guard exists to catch. Two rules
# learned this the hard way before it was made the standing convention.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

status=0

# --- 1. Firestore access outside the service layer -------------------------
#
# src/lib/db.ts is the only handle. Anything importing it, or the Firestore SDK
# directly, must live under src/services/.
violations=$(
	find src \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) \
		-not -path 'src/services/*' \
		-not -path 'src/types/*' \
		-not -path 'src/lib/db.ts' \
		-print0 2>/dev/null \
		| xargs -0 grep -lE "from \"[^\"]*lib/db\"|@react-native-firebase/firestore" 2>/dev/null \
		| sed "s|^\./||" \
		| sort || true
)
for file in $violations; do
	echo "LAYERING: $file reaches Firestore directly — go through a service."
	status=1
done

# --- 2. Services must not depend on the layers above them ------------------
inverted=$(
	find src/services \( -name '*.ts' -o -name '*.tsx' \) -print0 2>/dev/null \
		| xargs -0 grep -lE 'from "[^"]*(contexts|hooks|screens)/' 2>/dev/null \
		| sed "s|^\./||" | sort || true
)
for file in $inverted; do
	echo "LAYERING: $file imports from contexts/hooks/screens — services are the bottom layer."
	status=1
done

# --- 3. Unbounded queries --------------------------------------------------
#
# Every list query needs an explicit .limit(). v1 had none anywhere, which is
# how the calendar ended up streaming the whole collection.
unbounded=$(
	find src/services -name '*.ts' -print0 2>/dev/null \
		| xargs -0 grep -lE '\.where\(' 2>/dev/null \
		| sed "s|^\./||" | sort || true
)
for file in $unbounded; do
	if ! grep -q "\.limit(" "$file"; then
		echo "LAYERING: $file queries without a .limit() anywhere in the file."
		status=1
	fi
done

# --- 4. Field names from the old schema ------------------------------------
#
# Documents are still widely typed `any`, so tsc cannot see a stale field name.
# `new Date(entry.clockInTime)` on a current document is `new Date(undefined)`
# — an Invalid Date that only throws when something formats it, often several
# screens away from the mistake.
#
# Scoped to reads off a DOCUMENT-shaped variable. `originalValues.assignedWorkers`
# in useEventForm is a local dirty-check snapshot, not a Firestore document, so
# the field name there is legitimate.
#
# This rule used to scan only src/**/v2/**, back when the two schemas lived
# side by side. That scoping is why the export path below went unnoticed: it
# sits in src/services and src/utils, outside any v2 directory, and was never
# ported. It now scans all of src/.
OLD_FIELDS='\b(entry|item|timeEntry|event|doc|data|user|userData|snapshot)\??\.(clockInTime|clockOutTime|assignedWorkers|workerStatus|editHistory|connectedEvents|loggedInCompany|userNotes)\b'

# KNOWN UNPORTED, and failing in production today — the CSV/PDF export reads
# v1 field names off current documents and throws "Invalid time value" on the
# first entry. Delete these two lines as part of porting the export path; do
# not add to this list.
knownStale="src/services/exportService.ts
src/utils/timeUtils.ts"

stale=$(
	find src \( -name '*.ts' -o -name '*.tsx' \) -print0 2>/dev/null \
		| xargs -0 grep -nE "$OLD_FIELDS" 2>/dev/null \
		| grep -vE ':\s*(\*|//)' || true
)
while IFS= read -r line; do
	[ -n "$line" ] || continue
	file="${line%%:*}"
	grep -Fxq "$file" <<<"$knownStale" && continue
	echo "STALE FIELD NAME: $line"
	status=1
done <<<"$stale"

# --- 5. new Date() wrapping a Firestore Timestamp --------------------------
#
# `new Date(timestampField)` yields an Invalid Date, which only throws later
# when something formats it. Rule 4's line-based grep misses the multi-line
# form, where the field sits on its own line — which is how two of these
# survived into a screen that only breaks with more than one entry selected.
TS_FIELDS='clockInAt|clockOutAt|startAt|endAt|createdAt|updatedAt|decidedAt|submittedAt|joinedAt|pauseStartedAt'

badDates=$(
	find src \( -name '*.ts' -o -name '*.tsx' \) -print0 2>/dev/null \
		| xargs -0 perl -0777 -ne '
			while (/new Date\(\s*((?:[^()]|\([^()]*\))*?\.(?:'"$TS_FIELDS"'))\s*,?\s*\)/gs) {
				my $expr = $1; $expr =~ s/\s+/ /g;
				print "$ARGV: new Date($expr)\n";
			}' 2>/dev/null || true
)
if [ -n "$badDates" ]; then
	echo "new Date() ON A TIMESTAMP (use .toDate()):"
	echo "$badDates"
	status=1
fi

# --- 6. `.exists` used as a property ---------------------------------------
#
# In @react-native-firebase/firestore v23 `exists` is a METHOD. `doc.exists` is
# therefore a function reference, which is ALWAYS TRUTHY — so every missing
# document reads as existing and `data()` quietly returns undefined.
#
# It hid for a long time because the usual shape, `doc.exists ? map(doc) : null`,
# degrades to an object of undefined fields rather than throwing. It only became
# obvious where the check was decisive: issuing a join code treated every
# freshly generated code as taken and gave up after five tries.
#
# SCOPED TO src/ ON PURPOSE. tools/migration uses firebase-admin, where `exists`
# really is a property — the same expression is correct there and wrong here.
#
# Pattern deliberately simple. An earlier version used a bracket expression with
# an escaped `]`, which the grep in an interactive shell accepted and the grep
# xargs actually execs did not — so the guard matched nothing and passed
# cheerfully. `._exists` cannot match this, since the literal ".exists" is not a
# substring of "._exists".
badExists=$(
	find src \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) -print0 2>/dev/null \
		| xargs -0 grep -nE '\.exists([^(]|$)' 2>/dev/null \
		| grep -vE ':[[:space:]]*(\*|//)' || true
)
if [ -n "$badExists" ]; then
	echo "\`.exists\` USED AS A PROPERTY (it is a method — this is always truthy):"
	echo "$badExists"
	status=1
fi

if [ "$status" -eq 0 ]; then
	echo "Layering OK."
fi
exit "$status"
