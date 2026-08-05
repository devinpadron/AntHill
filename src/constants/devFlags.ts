/*
 * Development-only switches. Every one of these is `__DEV__ &&`, so none can
 * reach a release build.
 */

/**
 * Mounts the v2 provider tree and a diagnostic screen instead of the normal
 * app, so the v2 stack (contexts -> hooks -> services -> rules -> indexes) can
 * be exercised against the `test` database before any screen is ported.
 *
 * Sign in through the normal app FIRST — the harness has no auth UI and relies
 * on the persisted session.
 */
export const V2_SMOKE_TEST = __DEV__ && true;
