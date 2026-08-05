/*
 * Development-only switches. Every one of these is `__DEV__ &&`, so none can
 * reach a release build.
 */

/**
 * Mounts the v2 provider tree instead of the normal app, so the whole v2 stack
 * (contexts -> hooks -> services -> rules -> indexes) can be exercised against
 * the `test` database before cutover.
 *
 * The harness now runs the real v2 AppNavigator, so it has its own login and
 * signup — a fresh account can be created here rather than first being tried
 * in the release that depends on it. A diagnostics screen sits alongside it.
 */
export const V2_SMOKE_TEST = __DEV__ && true;
