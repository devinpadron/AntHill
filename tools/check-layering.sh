#!/usr/bin/env bash
#
# Enforces screen -> hook -> service -> db.
#
# Runs in the husky pre-commit hook and in CI. No dependencies beyond git.
#
# The v1 tree violates this in 15 files; those are listed as known exceptions
# below and shrink to zero as Phase 2 progresses. Nothing NEW may be added.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

status=0

# --- 1. Firestore access outside the service layer -------------------------
#
# src/lib/db.ts is the only handle. Anything importing it, or the Firestore SDK
# directly, must live under src/services/.
violations=$(
	git grep -lE "from \"[^\"]*(lib/db|constants/firestore)\"|@react-native-firebase/firestore" -- \
		'src/*' \
		':!src/services/*' \
		':!src/lib/db.ts' \
		':!src/constants/firestore.js' \
		':!src/types/*' \
		2>/dev/null || true
)

# Known v1 violations, removed as Phase 2 rewrites each file.
known="src/contexts/CompanyContext.tsx
src/contexts/UploadManagerContext.tsx
src/utils/dbMigrationUtils.ts
src/utils/versionUtils.ts
src/screens/settings/admin/LabelCreator.tsx
src/screens/settings/admin/CompanyCustomForm.tsx
src/screens/settings/admin/ChecklistCreator.tsx
src/screens/settings/admin/PackageCreator.tsx
src/screens/calendar/EventDetails.tsx
src/screens/calendar/EventChecklists.tsx
src/screens/calendar/EventSubmit.tsx
src/components/time/CustomFormRender.tsx
src/components/time/FormFieldValue.tsx
src/hooks/useProfile.ts
src/hooks/usePullEvents.ts"

for file in $violations; do
	if ! grep -Fxq "$file" <<<"$known"; then
		echo "LAYERING: $file reaches Firestore directly — go through a service."
		status=1
	fi
done

# --- 2. Services must not depend on the layers above them ------------------
inverted=$(
	git grep -lE "from \"[^\"]*(contexts|hooks|screens)/" -- 'src/services/*' 2>/dev/null || true
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
	git grep -lE "\.where\(" -- 'src/services/v2/*' 2>/dev/null || true
)
for file in $unbounded; do
	if ! grep -q "\.limit(" "$file"; then
		echo "LAYERING: $file queries without a .limit() anywhere in the file."
		status=1
	fi
done

# --- 4. v1 field names inside the v2 tree ----------------------------------
#
# Most v2 components take `entry: any`, so tsc cannot see a stale field name.
# `new Date(entry.clockInTime)` on a v2 document is `new Date(undefined)` — an
# Invalid Date that only throws when something formats it, often several screens
# away from the mistake.
#
# Scoped to reads off a DOCUMENT-shaped variable. `originalValues.assignedWorkers`
# in useEventForm is a local dirty-check snapshot, not a Firestore document, so
# the field name there is legitimate.
V1_FIELDS='\b(entry|item|timeEntry|event|doc|data|user|userData|snapshot)\??\.(clockInTime|clockOutTime|assignedWorkers|workerStatus|editHistory|connectedEvents|loggedInCompany|userNotes)\b'

# Plain grep, NOT git grep: the v2 tree is not committed yet, and git grep
# silently skips untracked files — a guard that scans nothing always passes.
stale=$(
	find src -path '*/v2/*' \( -name '*.ts' -o -name '*.tsx' \) -print0 2>/dev/null \
		| xargs -0 grep -nE "$V1_FIELDS" 2>/dev/null \
		| grep -vE ':\s*(\*|//)' || true
)
if [ -n "$stale" ]; then
	echo "STALE v1 FIELD NAMES in the v2 tree:"
	echo "$stale"
	status=1
fi

# --- 5. v1 components rendered by the v2 tree ------------------------------
#
# Rule 4 only scans src/**/v2/**, so an UNPORTED child component reading v1
# field names was invisible to it — which is exactly how TimeEntryCard kept
# calling new Date(entry.clockInTime) on a v2 document and throwing
# "Invalid time value" three screens away.
#
# Any component a v2 file imports must either be ported, or provably free of
# v1 field reads.
V1_DOC_FIELDS='\b(entry|item|timeEntry|event|doc|data|user|userData)\??\.(clockInTime|clockOutTime|assignedWorkers|workerStatus|editHistory|connectedEvents|loggedInCompany|userNotes)\b'

for importer in $(find src -path '*/v2/*' \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null); do
	dir=$(dirname "$importer")
	for rel in $(grep -oE 'from "[^"]*/(components|screens)/[^"]*"' "$importer" 2>/dev/null \
			| sed 's/from "//;s/"//' | grep -v '/v2/'); do
		target=$(cd "$dir" && realpath -q "$rel.tsx" 2>/dev/null)
		[ -f "$target" ] || continue
		if grep -qE "$V1_DOC_FIELDS" "$target" 2>/dev/null; then
			echo "UNPORTED v1 COMPONENT: ${target#$PWD/}"
			echo "    rendered by ${importer}, and it reads v1 document fields"
			status=1
		fi
	done
done

# --- 6. new Date() wrapping a Firestore Timestamp --------------------------
#
# `new Date(timestampField)` yields an Invalid Date, which only throws later
# when something formats it. Rule 4's line-based grep missed the multi-line
# form, where the field sits on its own line — which is how two of these
# survived into a screen that only breaks with more than one entry selected.
TS_FIELDS='clockInAt|clockOutAt|startAt|endAt|createdAt|updatedAt|decidedAt|submittedAt|joinedAt|pauseStartedAt'

badDates=$(
	find src -path '*/v2/*' \( -name '*.ts' -o -name '*.tsx' \) -print0 2>/dev/null \
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

if [ "$status" -eq 0 ]; then
	echo "Layering OK."
fi
exit "$status"
