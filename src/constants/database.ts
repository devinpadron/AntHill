/*
 * Which Firestore database this build talks to.
 *
 * THE single source of truth — src/lib/db.ts selects the instance from this
 * constant rather than re-deriving it, so the handle and anything that displays
 * it can never disagree.
 *
 * This lives in constants/ rather than lib/ deliberately: it touches no
 * Firestore API, so UI can import it without breaching the service-layer
 * boundary that the pre-commit guard enforces.
 *
 * It matters because `test` is now a full copy of production. The data is
 * identical, so nothing on screen distinguishes them — the app has to say so
 * explicitly.
 */
export const DATABASE_ID: "test" | "(default)" = __DEV__ ? "test" : "(default)";

export const IS_PRODUCTION_DB = DATABASE_ID === "(default)";

/** Short label for display. */
export const DATABASE_LABEL = IS_PRODUCTION_DB ? "PROD" : "TEST";
