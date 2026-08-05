/*
 * Whether a signup is mid-flight.
 *
 * Signup has to create the auth account BEFORE it can check the join code,
 * because reading `companies` requires authentication. So for a moment there
 * is a signed-in user with no profile, no membership, and possibly no future —
 * if the code turns out to be bad, signup deletes the account again.
 *
 * UserContext reacts to that account appearing by telling the user to verify
 * their email. On a failed signup that produced two alerts at once: "verify
 * your email" for an account being deleted, and "invalid access code". This
 * flag lets UserContext stay quiet until signup knows how it ended.
 *
 * Deliberately a module-level boolean rather than context state: it is read
 * from inside an auth callback that must not re-render anything, and it exists
 * for the few hundred milliseconds neither owner can see the other.
 */
let inProgress = false;

export const beginSignup = () => {
	inProgress = true;
};

export const endSignup = () => {
	inProgress = false;
};

export const isSignupInProgress = () => inProgress;
