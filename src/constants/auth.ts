/*
 * How long a session survives without the server confirming it.
 *
 * The app re-checks the session whenever it can reach Firebase. When it cannot,
 * it keeps the user signed in rather than throwing them out — the data they
 * need is already in the Firestore disk cache, and a login screen is useless to
 * someone with no signal.
 *
 * That trust has to expire eventually, hence this window. Thirty days is chosen
 * to clear the longest realistic gap by a wide margin: a worker doing a
 * fortnight at a rural venue, or a phone left in a bag between seasons, must
 * come back to a working app rather than a login screen.
 *
 * IT IS NOT A SECURITY BOUNDARY, and should not be shortened as if it were.
 * Firestore's rules are enforced server-side on every read and write, so a
 * device inside its grace window can still only see what its cache already
 * holds and can still only write what the rules allow. The moment it reaches
 * the network, an actually-revoked account is signed out immediately —
 * isAuthoritativeRejection in src/utils/authUtils.ts does not wait for grace.
 */
export const OFFLINE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
