/*
 * Development-only switches. Every one of these is `__DEV__ &&`, so none can
 * reach a release build.
 */

/**
 * Diagnostics harness.
 *
 * OFF by default now that the app itself is v2 — leaving it on would mean dev
 * never exercises the pieces the harness deliberately omits (AppGate and
 * NotificationProvider), which is exactly where an untested difference would
 * hide.
 *
 * Turn it on to get the v2 diagnostics screen and the PROD/TEST database badge,
 * which are worth having when a query or a rule is misbehaving. It mounts the
 * same v2 contexts, so what it shows is what the app sees.
 */
export const V2_SMOKE_TEST = __DEV__ && false;
