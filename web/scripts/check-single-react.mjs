/*
 * Fails if the built bundle contains more than one copy of React.
 *
 *   node scripts/check-single-react.mjs        (after a build)
 *
 * WHY THIS EXISTS. The portal imports hooks verbatim from ../src/hooks. Those
 * files sit outside web/, so Node resolution walks up from their own directory
 * and finds the REPO ROOT's node_modules/react, while everything under web/src
 * resolves to web/node_modules/react. Two instances of the identical version,
 * and the second one's hook dispatcher is null:
 *
 *   TypeError: Cannot read properties of null (reading 'useState')
 *       at useCompanyMembers.ts
 *
 * It breaks every page that uses a shared hook, which is most of them, and it
 * does so only at runtime — typecheck and build both pass cleanly. `dedupe` in
 * vite.config.ts fixes it; this makes sure nobody removes it, and catches the
 * same class of problem if a new shared dependency is added.
 *
 * The bundle sourcemap is the evidence: it lists every source file that went
 * in, with paths relative to the output. One copy is ../../node_modules/react;
 * a second shows up as ../../../node_modules/react.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(here, "../dist/assets");

/** Packages that MUST be singletons — more than one copy is a runtime bug. */
const SINGLETONS = ["react", "react-dom", "scheduler"];

let maps;
try {
	maps = readdirSync(ASSETS).filter((f) => f.endsWith(".js.map"));
} catch {
	console.error("No dist/assets — run `npm run build` first.");
	process.exit(1);
}

if (!maps.length) {
	console.error("No sourcemaps in dist/assets. Is build.sourcemap enabled?");
	process.exit(1);
}

const found = new Map(); // package name -> Set of distinct paths

for (const file of maps) {
	const map = JSON.parse(readFileSync(join(ASSETS, file), "utf8"));
	for (const source of map.sources ?? []) {
		for (const pkg of SINGLETONS) {
			// Anchored so "react" does not also match "react-dom".
			const match = source.match(new RegExp(`^(.*node_modules/${pkg})/`));
			if (!match) continue;
			if (!found.has(pkg)) found.set(pkg, new Set());
			found.get(pkg).add(match[1]);
		}
	}
}

let failed = false;
for (const [pkg, paths] of found) {
	if (paths.size > 1) {
		failed = true;
		console.error(`${pkg} is bundled ${paths.size} times:`);
		for (const path of [...paths].sort()) console.error(`  ${path}`);
	}
}

if (failed) {
	console.error(
		"\nMore than one copy of a singleton package is in the bundle.\n" +
			"React hooks will throw at runtime. Check `resolve.dedupe` in\n" +
			"vite.config.ts covers every package listed above.",
	);
	process.exit(1);
}

console.log(
	`Singletons OK — ${[...found.keys()].join(", ")} each bundled exactly once.`,
);
