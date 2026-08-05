/*
 * Development-only switches. Every one of these is `__DEV__ &&`, so none can
 * reach a release build.
 */

/**
 * Diagnostics harness.
 *
 * OFF by default. Leaving it on would mean dev never exercises the pieces the
 * harness deliberately omits — AppGate and NotificationProvider — which is
 * exactly where an untested difference would hide.
 *
 * Turn it on for the diagnostics screen and the PROD/TEST database badge, both
 * worth having when a query or a security rule is misbehaving. It mounts the
 * same contexts as the app, so what it shows is what the app sees.
 */
export const DIAGNOSTICS_MODE = __DEV__ && false;
