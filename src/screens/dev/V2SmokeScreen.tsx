import React, { useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import auth from "@react-native-firebase/auth";
import { useUser } from "../../contexts/v2/UserContext";
import { useCompany } from "../../contexts/v2/CompanyContext";
import { useCalendarEvents } from "../../hooks/v2/useCalendarEvents";
import { useCompanyMembers } from "../../hooks/v2/useCompanyMembers";
import { useTimeTracking } from "../../hooks/v2/useTimeTracking";
import { useFormSchema } from "../../hooks/v2/useFormSchema";
import { FilterType } from "../../types/enums/FilterType";
import { AntHill } from "../../constants/colors";
import {
	DATABASE_ID,
	DATABASE_LABEL,
	IS_PRODUCTION_DB,
} from "../../constants/database";

/*
 * Diagnostic harness for the v2 stack.
 *
 * Not a screen anyone ships — it exists so the whole chain can be exercised on
 * a device before any real UI is ported. Everything below reaches Firestore
 * through the v2 services, so a failure here is a genuine failure of the rules,
 * the indexes, or the query shapes, not of presentation.
 *
 * Enable with V2_SMOKE_TEST in src/constants/devFlags.ts.
 */

const Row = ({
	label,
	value,
	bad,
}: {
	label: string;
	value: string | number | null | undefined;
	bad?: boolean;
}) => (
	<View style={styles.row}>
		<Text style={styles.label}>{label}</Text>
		<Text style={[styles.value, bad && styles.bad]}>
			{value === null || value === undefined ? "—" : String(value)}
		</Text>
	</View>
);

const Section = ({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) => (
	<View style={styles.section}>
		<Text style={styles.heading}>{title}</Text>
		{children}
	</View>
);

export const V2SmokeScreen = ({ navigation }: { navigation: any }) => {
	const {
		user,
		userId,
		companyId,
		membership,
		role,
		isAdmin,
		loggedIn,
		isLoading,
		initializing,
	} = useUser();
	const {
		company,
		preferences,
		timeZone,
		isLoading: companyLoading,
	} = useCompany();

	const [filter, setFilter] = useState<FilterType>(FilterType.ALL);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [signInError, setSignInError] = useState<string | null>(null);
	const [signingIn, setSigningIn] = useState(false);

	const signIn = async () => {
		setSigningIn(true);
		setSignInError(null);
		try {
			await auth().signInWithEmailAndPassword(email.trim(), password);
		} catch (e: any) {
			setSignInError(e?.message ?? String(e));
		} finally {
			setSigningIn(false);
		}
	};

	const calendar = useCalendarEvents({
		companyId: companyId ?? "",
		userId,
		filterType: filter,
	});
	const members = useCompanyMembers(companyId ?? "");
	const time = useTimeTracking(companyId ?? "", userId, timeZone);
	const eventForm = useFormSchema(
		preferences.eventFormSchemaId,
		companyId ?? "",
	);

	if (initializing) {
		return (
			<SafeAreaView style={styles.container}>
				<ActivityIndicator />
			</SafeAreaView>
		);
	}

	// `loggedIn` is false both before auth resolves and after it resolves to
	// nobody. Showing the sign-in form during the first case would flash it at
	// an already-authenticated user, so wait for isLoading to settle.
	if (!loggedIn && isLoading) {
		return (
			<SafeAreaView style={styles.container}>
				<ActivityIndicator />
				<Text style={styles.note}>Resolving auth…</Text>
			</SafeAreaView>
		);
	}

	if (!loggedIn) {
		return (
			<SafeAreaView style={styles.container}>
				<ScrollView contentContainerStyle={styles.content}>
					<Text style={styles.title}>v2 stack — sign in</Text>
					<Text style={styles.note}>
						Firebase Auth is project-wide, so these are your normal
						credentials. Data still comes from the `test` database.
					</Text>

					<View style={styles.section}>
						<TextInput
							style={styles.input}
							placeholder="email"
							autoCapitalize="none"
							autoCorrect={false}
							keyboardType="email-address"
							value={email}
							onChangeText={setEmail}
						/>
						<TextInput
							style={styles.input}
							placeholder="password"
							secureTextEntry
							value={password}
							onChangeText={setPassword}
						/>
						<TouchableOpacity
							style={styles.button}
							onPress={signIn}
							disabled={signingIn}
						>
							{signingIn ? (
								<ActivityIndicator color="#fff" />
							) : (
								<Text style={styles.buttonText}>Sign in</Text>
							)}
						</TouchableOpacity>
						{signInError ? (
							<Text style={styles.errorText}>{signInError}</Text>
						) : null}
					</View>

					<Text style={styles.note}>
						Unverified accounts are signed straight back out — that
						is the v1 behaviour, preserved deliberately.
					</Text>
				</ScrollView>
			</SafeAreaView>
		);
	}

	const agendaDays = Object.keys(calendar.agendaItems).length;

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={styles.title}>
					v2 stack — {__DEV__ ? "test" : "PROD"} db
				</Text>

				<Section title="UserContext">
					<Row label="loggedIn" value={String(loggedIn)} />
					<Row label="isLoading" value={String(isLoading)} />
					<Row label="userId" value={userId || null} bad={!userId} />
					<Row label="user.email" value={user?.email} bad={!user} />
					<Row label="companyId" value={companyId} bad={!companyId} />
					<Row
						label="membership"
						value={membership ? "resolved" : null}
						bad={!membership}
					/>
					<Row label="role" value={role || null} />
					<Row label="isAdmin" value={String(isAdmin)} />
				</Section>

				<Section title="CompanyContext">
					<Row label="isLoading" value={String(companyLoading)} />
					<Row
						label="company.name"
						value={company?.name}
						bad={!company}
					/>
					<Row label="timeZone" value={timeZone} />
					<Row
						label="enableTimeSheet"
						value={String(preferences.enableTimeSheet)}
					/>
					<Row
						label="enableAvailability"
						value={String(preferences.enableAvailability)}
					/>
					<Row
						label="eventFormSchemaId"
						value={preferences.eventFormSchemaId}
					/>
				</Section>

				<Section title="useCompanyMembers (one query)">
					<Row label="isLoading" value={String(members.isLoading)} />
					<Row
						label="count"
						value={members.members.length}
						bad={!members.members.length}
					/>
					<Row
						label="first"
						value={members.members[0]?.displayName ?? null}
					/>
					<Row
						label="first role"
						value={members.members[0]?.role ?? null}
					/>
				</Section>

				<Section title="useCalendarEvents (windowed)">
					<View style={styles.filters}>
						{[
							FilterType.ALL,
							FilterType.MY,
							FilterType.UNASSIGNED,
						].map((f) => (
							<TouchableOpacity
								key={f}
								onPress={() => setFilter(f)}
								style={[
									styles.chip,
									filter === f && styles.chipOn,
								]}
							>
								<Text
									style={
										filter === f
											? styles.chipOnText
											: styles.chipText
									}
								>
									{f}
								</Text>
							</TouchableOpacity>
						))}
					</View>
					<Row label="isLoading" value={String(calendar.isLoading)} />
					<Row
						label="error"
						value={calendar.error ? calendar.error.message : "none"}
						bad={Boolean(calendar.error)}
					/>
					<Row
						label="window"
						value={`${calendar.window.from} → ${calendar.window.to}`}
					/>
					<Row label="events" value={calendar.events.length} />
					<Row label="agenda days" value={agendaDays} />
					<Row
						label="marked dates"
						value={Object.keys(calendar.markedDates).length}
					/>
					<Row
						label="labels"
						value={Object.keys(calendar.labels).length}
					/>
					<Row
						label="first event"
						value={calendar.events[0]?.title ?? null}
					/>
					<Row
						label="first startAt"
						value={
							calendar.events[0]?.startAt
								? calendar.events[0].startAt
										.toDate()
										.toISOString()
								: "all-day / none"
						}
					/>
				</Section>

				<Section title="useTimeTracking">
					<Row label="isLoading" value={String(time.isLoading)} />
					<Row
						label="activeEntry"
						value={time.activeEntry ? time.activeEntry.id : "none"}
					/>
					<Row label="isActive" value={String(time.isActive)} />
					<Row label="entries loaded" value={time.entries.length} />
					<Row label="hasMore" value={String(time.hasMore)} />
					<Row label="todayKey" value={time.todayKey} />
					<Row
						label="latest review"
						value={
							time.entries.find((e) => e.review)?.review
								?.provenance ?? "none"
						}
					/>
				</Section>

				<Section title="useFormSchema">
					<Row
						label="isLoading"
						value={String(eventForm.isLoading)}
					/>
					<Row
						label="schema"
						value={eventForm.schema?.id ?? "none"}
					/>
					<Row
						label="version"
						value={eventForm.schema?.version ?? null}
					/>
					<Row
						label="fields"
						value={eventForm.schema?.fields?.length ?? null}
					/>
					<Row
						label="checklists resolved"
						value={Object.keys(eventForm.checklists).length}
					/>
				</Section>

				<TouchableOpacity
					style={[styles.button, styles.openCalendar]}
					onPress={() => navigation.goBack()}
				>
					<Text style={styles.buttonText}>Back to app</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[styles.button, styles.signOut]}
					onPress={() => auth().signOut()}
				>
					<Text style={styles.buttonText}>Sign out</Text>
				</TouchableOpacity>

				<Text style={styles.note}>
					Any red value is a real failure of the v2 stack. An empty
					calendar with no error means the window genuinely holds no
					events — widen it or switch filters to confirm.
				</Text>
			</ScrollView>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: AntHill.Cream },
	content: { padding: 16, paddingBottom: 48 },
	dbBanner: {
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 12,
		marginBottom: 14,
		alignItems: "center",
	},
	/*
	 * test is a byte-for-byte copy of production, so the contents cannot tell
	 * you which one you are on. This banner is the only thing that can.
	 */
	dbBannerTest: { backgroundColor: "#2F3B16" },
	dbBannerProd: { backgroundColor: "#B3261E" },
	dbBannerText: { color: "#fff", fontSize: 14, fontWeight: "700" },
	dbBannerSub: {
		color: "#fff",
		fontSize: 11,
		opacity: 0.85,
		marginTop: 2,
	},
	title: {
		fontSize: 20,
		fontWeight: "700",
		color: AntHill.Black,
		marginBottom: 16,
	},
	section: {
		backgroundColor: "#fff",
		borderRadius: 10,
		padding: 12,
		marginBottom: 12,
	},
	heading: {
		fontSize: 15,
		fontWeight: "600",
		color: AntHill.Green,
		marginBottom: 8,
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 3,
	},
	label: { fontSize: 13, color: "#666", flex: 1 },
	value: {
		fontSize: 13,
		color: AntHill.Black,
		flex: 1,
		textAlign: "right",
		fontWeight: "500",
	},
	bad: { color: "#c0392b", fontWeight: "700" },
	filters: { flexDirection: "row", marginBottom: 8 },
	chip: {
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 14,
		backgroundColor: "#eee",
		marginRight: 6,
	},
	chipOn: { backgroundColor: AntHill.Green },
	chipText: { fontSize: 12, color: "#444" },
	chipOnText: { fontSize: 12, color: "#fff", fontWeight: "600" },
	input: {
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
		marginBottom: 10,
		fontSize: 15,
	},
	button: {
		backgroundColor: AntHill.Green,
		borderRadius: 8,
		paddingVertical: 12,
		alignItems: "center",
	},
	buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
	errorText: { color: "#c0392b", fontSize: 12, marginTop: 10 },
	signOut: { backgroundColor: "#999", marginBottom: 12 },
	openCalendar: { marginBottom: 10 },
	floatingBack: {
		position: "absolute",
		bottom: 30,
		alignSelf: "center",
		backgroundColor: AntHill.Black,
		paddingHorizontal: 18,
		paddingVertical: 10,
		borderRadius: 20,
	},
	note: {
		fontSize: 12,
		color: "#666",
		lineHeight: 17,
		marginTop: 4,
		textAlign: "center",
	},
});
