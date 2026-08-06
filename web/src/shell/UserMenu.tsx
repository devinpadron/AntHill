import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme, type ThemeMode } from "../theme/ThemeProvider";
import { Icon, Text } from "../ui";
import styles from "./UserMenu.module.css";

/*
 * Signed-in identity, theme switch, and sign-out.
 *
 * Theme offers the same three modes as the app (light / dark / system). The app
 * persists the choice to users/{uid}/settings so it follows the account; the
 * portal keeps it in localStorage instead — a shared office machine should not
 * push its theme onto the admin's phone.
 */

const MODES: {
	value: ThemeMode;
	label: string;
	icon: "sunny-outline" | "moon-outline" | "apps-outline";
}[] = [
	{ value: "light", label: "Light", icon: "sunny-outline" },
	{ value: "dark", label: "Dark", icon: "moon-outline" },
	{ value: "system", label: "System", icon: "apps-outline" },
];

export function UserMenu({ collapsed }: { collapsed: boolean }) {
	const { user, signOut } = useAuth();
	const { mode, setMode } = useTheme();
	const [open, setOpen] = useState(false);

	const name = user ? `${user.firstName} ${user.lastName}`.trim() : "";
	const initials =
		[user?.firstName?.[0], user?.lastName?.[0]]
			.filter(Boolean)
			.join("")
			.toUpperCase() || "?";

	return (
		<div className={styles.wrap}>
			<button
				className={styles.trigger}
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				aria-haspopup="menu"
				title={collapsed ? name : undefined}
			>
				<span className={styles.avatar}>{initials}</span>
				{!collapsed && (
					<span className={styles.identity}>
						<Text variant="label" clamp={1} as="span">
							{name || "Account"}
						</Text>
						<Text
							variant="caption"
							tone="tertiary"
							clamp={1}
							as="span"
						>
							{user?.email ?? ""}
						</Text>
					</span>
				)}
			</button>

			{open && (
				<>
					{/* Click-away layer — cheaper and more reliable than a
					    document listener that has to dodge the trigger. */}
					<div
						className={styles.backdrop}
						onClick={() => setOpen(false)}
					/>
					<div className={styles.menu} role="menu">
						<div className={styles.section}>
							<Text variant="overline" tone="tertiary">
								Theme
							</Text>
							<div className={styles.themeRow}>
								{MODES.map((option) => (
									<button
										key={option.value}
										role="menuitemradio"
										aria-checked={mode === option.value}
										className={[
											styles.themeOption,
											mode === option.value
												? styles.themeActive
												: "",
										]
											.filter(Boolean)
											.join(" ")}
										onClick={() => setMode(option.value)}
										title={option.label}
									>
										<Icon name={option.icon} size="sm" />
										<Text variant="caption" as="span">
											{option.label}
										</Text>
									</button>
								))}
							</div>
						</div>

						<button
							role="menuitem"
							className={styles.item}
							onClick={() => {
								setOpen(false);
								void signOut();
							}}
						>
							<Icon name="log-out-outline" size="sm" />
							<Text variant="body" as="span">
								Sign out
							</Text>
						</button>
					</div>
				</>
			)}
		</div>
	);
}
