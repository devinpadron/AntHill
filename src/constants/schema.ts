/*
 * Which Firestore schema versions this build can read and write.
 *
 * The active schema version lives in `appConfig/schema.activeVersion`. When the
 * server moves to a version this build does not list here, the app gates itself
 * behind a full-screen update prompt rather than reading data it cannot parse.
 *
 * This build ships against the v2 (flat, lowerCamel `companies`/`events`/...)
 * schema. It does NOT list 1, and that is the point: while the server still
 * says activeVersion 1, this build gates itself behind the update screen. The
 * release can therefore sit in the store, approved and inert, until the
 * migration window flips activeVersion to 2 — the gate holds it back, not the
 * rollout percentage.
 */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [2];

/*
 * Assumed when `appConfig/schema` is missing or unreadable, so a config outage
 * can never brick the app.
 *
 * Tracks the version this build ships against, which is what makes an outage
 * harmless rather than fatal. A DELIBERATE rollback is unaffected: that flips
 * activeVersion to 1 in a document the client can still read, so the gate fires
 * on the real value rather than on this.
 */
export const FALLBACK_ACTIVE_SCHEMA_VERSION = 2;
