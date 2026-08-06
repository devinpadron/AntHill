import React, {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useRef,
} from "react";
import { StyleSheet } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useMyCompanies } from "../../hooks/useMyCompanies";
import { Role } from "../../types/enums/Role";
import { EmptyState, ListRow, Loading, Sheet, Text, toast } from "../ui";
import { haptics, Theme, useThemedStyles } from "../../theme";

/**
 * Switching between the companies a user works for.
 *
 * Casual staff commonly work for two or three caterers, and the only way to
 * change company was buried three taps deep in Profile behind a dropdown.
 * Long-pressing the Settings tab opens this instead.
 *
 * Mounted once at the app root rather than per screen, because the sheet has
 * to sit above the tab bar it is opened from.
 */

type SwitcherContextValue = {
	open: () => void;
	/** False for a user in exactly one company — nothing to switch to. */
	available: boolean;
};

const SwitcherContext = createContext<SwitcherContextValue>({
	open: () => {},
	available: false,
});

/** Opens the company switcher from anywhere below the provider. */
export const useCompanySwitcher = () => useContext(SwitcherContext);

const ROLE_LABEL: Partial<Record<Role, string>> = {
	[Role.OWNER]: "Owner",
	[Role.MANAGER]: "Manager",
};

export const CompanySwitcherProvider: React.FC<{
	children: React.ReactNode;
}> = ({ children }) => {
	const styles = useThemedStyles(switcherStyles);
	const sheetRef = useRef<BottomSheet>(null);

	const { companies, activeCompanyId, isLoading, hasMultiple, switchTo } =
		useMyCompanies();

	const open = useCallback(() => {
		haptics.press();
		sheetRef.current?.snapToIndex(0);
	}, []);

	const close = useCallback(() => {
		sheetRef.current?.close();
	}, []);

	const select = useCallback(
		async (companyId: string, name: string) => {
			close();
			if (companyId === activeCompanyId) return;

			try {
				await switchTo(companyId);
				toast.success(`Switched to ${name}`);
			} catch (error) {
				console.error("Could not switch company", error);
				toast.error(
					"Could not switch",
					"Check your connection and try again.",
				);
			}
		},
		[activeCompanyId, close, switchTo],
	);

	const value = useMemo(
		() => ({ open, available: hasMultiple }),
		[open, hasMultiple],
	);

	return (
		<SwitcherContext.Provider value={value}>
			{children}

			<Sheet
				ref={sheetRef}
				snapPoints={["50%"]}
				title="Switch company"
				onClose={close}
			>
				{isLoading ? (
					<Loading label="Loading your companies" />
				) : companies.length === 0 ? (
					<EmptyState
						icon="business-outline"
						title="No companies"
						description="You're not a member of any company yet."
						compact
					/>
				) : (
					<BottomSheetScrollView contentContainerStyle={styles.list}>
						{companies.map((company, index) => {
							const active =
								company.companyId === activeCompanyId;

							return (
								<ListRow
									key={company.companyId}
									title={company.name}
									subtitle={ROLE_LABEL[company.role]}
									icon={
										active ? "business" : "business-outline"
									}
									iconColor={
										active ? "accent" : "textSecondary"
									}
									selected={active}
									separator={index < companies.length - 1}
									onPress={() =>
										select(company.companyId, company.name)
									}
								/>
							);
						})}

						{/* Only one company: say why there is nothing to pick. */}
						{companies.length === 1 && (
							<Text
								variant="caption"
								color="textTertiary"
								align="center"
								style={styles.hint}
							>
								You only belong to one company. Join another
								from your profile.
							</Text>
						)}
					</BottomSheetScrollView>
				)}
			</Sheet>
		</SwitcherContext.Provider>
	);
};

const switcherStyles = (theme: Theme) =>
	StyleSheet.create({
		list: {
			paddingTop: theme.spacing.sm,
			paddingBottom: theme.spacing.lg,
		},
		hint: {
			marginTop: theme.spacing.lg,
			paddingHorizontal: theme.spacing.xl,
		},
	});
