/*
 * Schema-neutral enums.
 *
 * These describe app-level concepts rather than document shapes, so they
 * survived the v1 -> v2 schema change unchanged and are shared by both the
 * Firestore models and the UI.
 *
 * Document shapes live in "./v2" — import those from there.
 */

export * from "./enums/Role";
export * from "./enums/FilterType";
