/*
 * Which Firestore schema versions this build can read and write.
 *
 * The active schema version lives in `appConfig/schema.activeVersion`. When the
 * server moves to a version this build does not list here, the app gates itself
 * behind a full-screen update prompt rather than reading data it cannot parse.
 *
 * This build ships against the v1 (PascalCase `Companies`/`Events`/...) schema.
 * The v2 build will declare [2].
 */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [1];

/* Assumed when `appConfig/schema` is missing or unreadable, so a config outage
 * can never brick the app. */
export const FALLBACK_ACTIVE_SCHEMA_VERSION = 1;
