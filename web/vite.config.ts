import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const APP = path.resolve(repoRoot, "src");
const shim = (file: string) => path.resolve(here, "src/shim", file);

/*
 * The portal imports the mobile app's service layer VERBATIM from ../src.
 *
 * Those files import `@react-native-firebase/*`, which cannot load in a
 * browser. Every such specifier is aliased to an adapter under src/shim/ that
 * re-exposes the RNFirebase chaining API over the Firebase web SDK. Nothing
 * under ../src changes, so the app and the portal can never drift apart on
 * how they read or write Firestore.
 *
 * The alias list must stay in lockstep with the `paths` map in tsconfig.json,
 * or tsc resolves these specifiers to the real packages in the parent
 * node_modules and type-checks against the wrong API.
 */
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, here, "VITE_");

	/*
	 * src/constants/database.ts reads the __DEV__ global to choose between the
	 * "test" and "(default)" Firestore databases. That file is shared with the
	 * app and is not modified, so the switch has to be __DEV__ itself.
	 *
	 * Default is "test": an unconfigured build must never reach production data.
	 */
	const useTestDb = (env.VITE_ANTHILL_DB ?? "test") !== "default";

	return {
		plugins: [
			react(),
			/*
			 * `define` below rewrites __DEV__ statically, but ONLY during a
			 * production build. In serve mode Vite's define plugin skips
			 * modules outside the project root — and every shared file lives at
			 * ../src, i.e. outside web/. So in dev the identifier survives
			 * untouched and src/constants/database.ts throws
			 * "__DEV__ is not defined" the moment anything imports a service.
			 *
			 * Injecting it as a real global ahead of the module graph covers
			 * that. It is inert in a production build, where `define` has
			 * already folded every reference to a literal.
			 */
			{
				name: "anthill-dev-globals",
				transformIndexHtml() {
					return [
						{
							tag: "script",
							attrs: { type: "module" },
							children: `globalThis.__DEV__ = ${JSON.stringify(useTestDb)};`,
							injectTo: "head-prepend" as const,
						},
					];
				},
			},
		],

		define: {
			__DEV__: JSON.stringify(useTestDb),
			/*
			 * A stamp for the running build, surfaced on /diagnostics.
			 *
			 * Without it there is no way to tell a genuine failure from a
			 * browser holding a stale module — which cost three debugging
			 * rounds on the conformance harness, all of them chasing code that
			 * may not have been the code running.
			 */
			__BUILD_STAMP__: JSON.stringify(
				new Date().toISOString().slice(11, 19),
			),
		},

		resolve: {
			/*
			 * ONE React, or hooks break.
			 *
			 * The portal imports hooks verbatim from ../src/hooks. Those files
			 * live outside web/, so Node resolution walks up from THEIR
			 * directory and finds the repo root's node_modules/react — while
			 * anything under web/src resolves to web/node_modules/react. Two
			 * instances of the same version, and the second one's hook
			 * dispatcher is null:
			 *
			 *   TypeError: Cannot read properties of null (reading 'useState')
			 *       at useCompanyMembers.ts
			 *
			 * It surfaces in EVERY page using a shared hook, which is most of
			 * them. dedupe forces both to web/node_modules — the Vite root's
			 * copy — so there is exactly one.
			 *
			 * Verify after changing this: the build sourcemap must list only
			 * ../../node_modules/react, never ../../../node_modules/react.
			 */
			dedupe: ["react", "react-dom", "react/jsx-runtime", "scheduler"],
			/*
			 * Array form, because order matters and the react-native entry has
			 * to be an exact-match regex — a plain "react-native" string would
			 * also swallow "react-native-fs" and friends by prefix.
			 */
			alias: [
				{ find: "@app", replacement: APP },
				{
					find: "@react-native-firebase/firestore",
					replacement: shim("rnfb-firestore.ts"),
				},
				{
					find: "@react-native-firebase/app",
					replacement: shim("rnfb-app.ts"),
				},
				{
					find: "@react-native-firebase/auth",
					replacement: shim("rnfb-auth.ts"),
				},
				{
					find: "@react-native-firebase/storage",
					replacement: shim("rnfb-storage.ts"),
				},
				{
					find: "react-native-html-to-pdf",
					replacement: shim("rn-html-to-pdf.ts"),
				},
				{
					find: "react-native-prompt-android",
					replacement: shim("rn-prompt.ts"),
				},
				{
					find: "react-native-calendars/src/types",
					replacement: shim("rn-calendars-types.ts"),
				},
				{ find: "react-native-fs", replacement: shim("rn-fs.ts") },
				{
					find: /^react-native$/,
					replacement: shim("react-native.ts"),
				},
			],
		},

		server: {
			port: 5173,
			// ../src is outside the Vite root, so the dev server has to be told
			// it may serve from there.
			fs: { allow: [repoRoot] },
		},

		build: {
			outDir: "dist",
			sourcemap: true,
		},
	};
});
