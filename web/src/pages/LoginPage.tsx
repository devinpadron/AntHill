import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import auth from "@react-native-firebase/auth";
import { mapLoginError } from "@app/utils/authUtils";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, Input, Text, LoadingPane, useToast } from "../ui";
import styles from "./LoginPage.module.css";

/*
 * Sign-in. There is deliberately NO SIGN-UP here.
 *
 * A portal account is a mobile account that an owner has promoted to manager.
 * Offering registration would let someone create an account that lands on the
 * "you are not an admin anywhere" screen, which is a dead end that looks like a
 * bug.
 *
 * Error mapping reuses ../../src/utils/authUtils.ts `mapLoginError` — pure
 * TypeScript over Firebase's auth/* error codes, which are identical on web —
 * so the portal words a wrong password exactly as the app does.
 */
export function LoginPage() {
	const { loggedIn, initializing, adminMemberships, isLoading } = useAuth();
	const location = useLocation();
	const toast = useToast();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);
	const [resetting, setResetting] = useState(false);

	if (initializing) return <LoadingPane label="Starting up" />;

	if (loggedIn && !isLoading) {
		const from = (location.state as { from?: Location } | null)?.from;
		if (from?.pathname) return <Navigate to={from.pathname} replace />;
		return (
			<Navigate
				to={
					adminMemberships.length === 1
						? `/${adminMemberships[0].companyId}/calendar`
						: "/select-company"
				}
				replace
			/>
		);
	}

	if (loggedIn) return <LoadingPane label="Loading your companies" />;

	async function submit(event: FormEvent) {
		event.preventDefault();
		setErrors({});
		setBusy(true);
		try {
			await auth().signInWithEmailAndPassword(email.trim(), password);
		} catch (error) {
			setErrors(mapLoginError(error) as Record<string, string>);
		} finally {
			setBusy(false);
		}
	}

	async function resetPassword() {
		if (!email.trim()) {
			setErrors({ email: "Enter your email first" });
			return;
		}
		setResetting(true);
		try {
			await auth().sendPasswordResetEmail(email.trim());
			toast.success(
				"Check your email",
				"We sent a link to reset your password.",
			);
		} catch (error) {
			setErrors(mapLoginError(error) as Record<string, string>);
		} finally {
			setResetting(false);
		}
	}

	return (
		<div className={styles.page}>
			<Card className={styles.card}>
				<div className={styles.brand}>
					<Text variant="display" as="h1">
						AntHill
					</Text>
					<Text variant="body" tone="secondary">
						Admin portal
					</Text>
				</div>

				<form onSubmit={submit} className={styles.form}>
					<Input
						label="Email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						error={errors.email}
						autoComplete="username"
						autoFocus
						required
					/>
					<Input
						label="Password"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						error={errors.password}
						autoComplete="current-password"
						required
					/>

					{/* `form` is authUtils' key for an error that cannot be
					    blamed on one field — auth/invalid-credential collapses
					    a wrong email and a wrong password into one code. */}
					{errors.form && (
						<Text variant="caption" tone="danger" role="alert">
							{errors.form}
						</Text>
					)}

					<Button
						type="submit"
						variant="primary"
						size="large"
						busy={busy}
						fullWidth
					>
						Sign in
					</Button>

					<Button
						variant="ghost"
						onClick={resetPassword}
						busy={resetting}
					>
						Forgot password?
					</Button>
				</form>

				<Text variant="caption" tone="tertiary" align="center">
					Accounts are created in the AntHill app. Ask an owner to
					make you a manager to get access here.
				</Text>
			</Card>
		</div>
	);
}
