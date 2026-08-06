/*
 * Fails if any icon the portal references is not vendored.
 *
 * Icon.tsx returns null for an unknown name, so a typo or a newly used glyph is
 * a silently missing icon rather than an error. This catches it at commit time.
 *
 *   node scripts/check-icons.mjs
 *
 * TWO THINGS THIS GOT WRONG FIRST TIME, both worth keeping in mind:
 *
 *   1. Reading the vendored set by grepping for `"name":` misses most of it.
 *      Prettier unquotes identifier-safe keys, so `"close":` becomes `close:`.
 *      The key pattern below accepts both.
 *
 *   2. Extracting names with a bare ternary regex (`? "a" : "b"`) matches every
 *      ternary in the codebase — theme modes, button variants, "yes"/"no". Name
 *      extraction is scoped to the icon-bearing PROP first, and only then are
 *      string literals pulled out of it.
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../src");
const GENERATED = resolve(SRC, "ui/icons.generated.ts");

/** Keys of the generated ICONS map, quoted or not. */
const vendored = new Set(
	[...readFileSync(GENERATED, "utf8").matchAll(/^\t"?([a-z0-9-]+)"?:/gm)].map(
		(match) => match[1],
	),
);

/*
 * Places an icon name can appear:
 *   name="x"            name={cond ? "a" : "b"}
 *   icon="x"            icon={cond ? "a" : "b"}
 *   iconAfter="x"
 *   icon: "x" as IconName        (the SideNav item arrays)
 *   iconActive: "x" as IconName
 */
/** Braced form — the capture is an EXPRESSION containing zero or more names. */
const EXPRESSION_PATTERN = /\b(?:name|icon|iconAfter)=\{([^}]*)\}/g;

/** Direct form — the capture IS the name. */
const LITERAL_PATTERNS = [
	/\b(?:name|icon|iconAfter)="([a-z0-9-]+)"/g,
	/\b(?:icon|iconActive):\s*"([a-z0-9-]+)"(?:\s+as\s+IconName)?/g,
];

function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(path));
		else if (
			/\.tsx?$/.test(entry.name) &&
			!entry.name.endsWith(".generated.ts")
		) {
			out.push(path);
		}
	}
	return out;
}

const used = new Map();

for (const file of walk(SRC)) {
	const text = readFileSync(file, "utf8");
	for (const pattern of LITERAL_PATTERNS) {
		for (const match of text.matchAll(pattern)) {
			if (!used.has(match[1])) used.set(match[1], file);
		}
	}

	for (const match of text.matchAll(EXPRESSION_PATTERN)) {
		/*
		 * Pull string literals out of the expression, but strip COMPARISON
		 * OPERANDS first. `name={tone === "error" ? "alert-circle" : icon}`
		 * holds two literals and only one is an icon; without this the check
		 * reports "error" as a missing glyph.
		 *
		 * A bare identifier (`name={icon}`) yields nothing, deliberately: the
		 * value is only known at runtime, so there is nothing to verify.
		 */
		const expression = match[1].replace(/[=!]==?\s*"[a-z0-9-]+"/g, "");
		for (const literal of expression.matchAll(/"([a-z0-9-]+)"/g)) {
			if (!used.has(literal[1])) used.set(literal[1], file);
		}
	}
}

const missing = [...used].filter(([name]) => !vendored.has(name));

if (missing.length) {
	console.error("Icons used but not vendored:");
	for (const [name, file] of missing) {
		console.error(`  ${name}  (${file.replace(SRC, "src")})`);
	}
	console.error("\nAdd them to scripts/build-icons.mjs and re-run it.");
	process.exit(1);
}

console.log(
	`Icons OK — ${used.size} referenced, ${vendored.size} vendored, none missing.`,
);
