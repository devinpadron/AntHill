import { useState } from "react";
import { Alert } from "react-native";
import auth from "@react-native-firebase/auth";
import { capitalize } from "lodash";
import { createUser } from "../../services/v2/userService";
import {
	joinCompanyWithAccessCode,
	resolveJoinCode,
} from "../../services/v2/membershipService";
import { validateSignupFields, handleAuthError } from "../../utils/authUtils";

/*
 * Signup, against the v2 schema.
 *
 * v1 wrote `Users/{uid}` with an embedded `companies[]` and a second document
 * at `Companies/{c}/Users/{uid}`. v2 writes `users/{uid}` and one
 * `memberships/{companyId}_{userId}`, through the same service the join flow
 * uses — so a new account and an existing user joining a second company
 * produce byte-identical membership records.
 *
 * The code field accepts a company access code OR a group join code. A group
 * code lands the new hire in that group with the visibility the manager chose,
 * which is the whole point: a contractor is restricted from their very first
 * launch rather than depending on someone setting it afterwards.
 *
 * ORDER IS LOAD-BEARING, twice over:
 *
 *   1. The account is created BEFORE any Firestore read, because the companies
 *      collection requires authentication (see firestore.rules).
 *   2. The code is resolved BEFORE the user document is written, because
 *      `users/{uid}` cannot be deleted by its owner — the rules say
 *      `allow delete: if false`. A signup that wrote the profile first and
 *      then found a bad code would strand a document it has no way to remove.
 *      Only the auth account can be rolled back, so nothing else may exist
 *      before the code is known to be good.
 */
export const useSignUp = (navigation: any) => {
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confPassword, setConfPassword] = useState("");
	const [accessCode, setAccessCode] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSignUp = async () => {
		if (
			!validateSignupFields(
				firstName,
				lastName,
				email,
				password,
				confPassword,
				accessCode,
			)
		) {
			return;
		}

		setIsLoading(true);

		try {
			const userCredential = await auth().createUserWithEmailAndPassword(
				email,
				password,
			);
			const user = userCredential.user;

			const resolved = await resolveJoinCode(accessCode);
			if (!resolved) {
				// Roll the account back so a bad code does not strand a
				// half-created user with no profile and no membership.
				try {
					await user.delete();
				} catch (deleteError) {
					console.error(
						"Failed to roll back account after invalid access code",
						deleteError,
					);
				}
				Alert.alert("Invalid Access Code");
				return;
			}

			await user.updateProfile({
				displayName: `${capitalize(firstName)} ${capitalize(lastName)}`,
			});

			await createUser(user.uid, {
				firstName: capitalize(firstName),
				lastName: capitalize(lastName),
				email: email.trim(),
			});

			/*
			 * One transaction writes the membership and points the user at the
			 * company. Passing `resolved` avoids repeating the lookup.
			 *
			 * If this throws the account and profile survive with no
			 * membership — recoverable, because the profile screen's "Join
			 * company" runs exactly this call. The reverse order would not be:
			 * a membership with no user document breaks every member list.
			 */
			await joinCompanyWithAccessCode(user.uid, accessCode, resolved);

			await user.sendEmailVerification();

			navigation.pop();
		} catch (error) {
			handleAuthError(error);
		} finally {
			setIsLoading(false);
		}
	};

	return {
		firstName,
		setFirstName,
		lastName,
		setLastName,
		email,
		setEmail,
		password,
		setPassword,
		confPassword,
		setConfPassword,
		accessCode,
		setAccessCode,
		isLoading,
		handleSignUp,
	};
};
