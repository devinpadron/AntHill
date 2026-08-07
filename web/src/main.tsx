import React from "react";
import { createRoot } from "react-dom/client";
import { registerKvStore } from "@app/lib/kvStore";
import { App } from "./App";

/*
 * The portal's half of the injected key-value backend.
 *
 * src/services may not import AsyncStorage — this app has no such dependency
 * and no vite alias for it — so shared code asks src/lib/kvStore for a backend
 * and each platform supplies one. See src/lib/kvStore.ts.
 *
 * localStorage is synchronous; the interface is async because the app's side is.
 * Wrapped so a quota error or a Safari private-mode throw surfaces as a rejected
 * promise rather than an exception thrown mid-render.
 */
registerKvStore({
	getItem: async (key) => localStorage.getItem(key),
	setItem: async (key, value) => {
		localStorage.setItem(key, value);
	},
	removeItem: async (key) => {
		localStorage.removeItem(key);
	},
	getAllKeys: async () => Object.keys(localStorage),
});

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from index.html");

createRoot(container).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
