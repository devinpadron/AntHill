import React, { useEffect, useState } from "react";
import {
	Modal,
	View,
	TouchableOpacity,
	Pressable,
	ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import { swapUserCompany } from "../../services/userService";
import { getCompanyById } from "../../services/companyService";
import { Text } from "./Text";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { Divider } from "./Divider";

interface CompanySwitcherSheetProps {
	visible: boolean;
	onClose: () => void;
}

/**
 * Bottom sheet that lists every company the signed-in user belongs to and
 * switches the active company. Company names are resolved lazily; the company
 * id is used as a fallback label.
 */
export const CompanySwitcherSheet: React.FC<CompanySwitcherSheetProps> = ({
	visible,
	onClose,
}) => {
	const { theme } = useTheme();
	const { user, userId } = useUser();
	const [names, setNames] = useState<Record<string, string>>({});
	const [switching, setSwitching] = useState(false);

	const companies: string[] = user?.companies ?? [];
	const activeCompany: string = user?.loggedInCompany ?? "";

	// Resolve company names when the sheet opens.
	useEffect(() => {
		if (!visible || companies.length === 0) return;

		let cancelled = false;
		(async () => {
			const entries = await Promise.all(
				companies.map(async (id) => {
					const data = await getCompanyById(id);
					return [id, data?.name ?? id] as const;
				}),
			);
			if (!cancelled) {
				setNames(Object.fromEntries(entries));
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [visible, companies.join(",")]);

	const handleSelect = async (companyId: string) => {
		if (companyId === activeCompany) {
			onClose();
			return;
		}
		try {
			setSwitching(true);
			await swapUserCompany(userId, companyId);
			onClose();
		} catch (error) {
			console.error("Error switching company:", error);
		} finally {
			setSwitching(false);
		}
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}
		>
			<Pressable
				style={{
					flex: 1,
					backgroundColor: "rgba(29,29,39,0.4)",
					justifyContent: "flex-end",
				}}
				onPress={onClose}
			>
				<Pressable
					onPress={(e) => e.stopPropagation()}
					style={{
						backgroundColor: theme.Surface,
						borderTopLeftRadius: 28,
						borderTopRightRadius: 28,
					}}
				>
					<SafeAreaView edges={["bottom"]}>
						{/* Grabber */}
						<View style={{ alignItems: "center", paddingTop: 10 }}>
							<View
								style={{
									width: 40,
									height: 4,
									borderRadius: 2,
									backgroundColor: theme.BorderColor,
								}}
							/>
						</View>

						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								paddingHorizontal: 20,
								paddingTop: 16,
								paddingBottom: 8,
							}}
						>
							<Text variant="h3" weight="semibold">
								Switch company
							</Text>
							{switching && (
								<ActivityIndicator
									size="small"
									color={theme.Accent}
								/>
							)}
						</View>

						<View
							style={{ paddingHorizontal: 12, paddingBottom: 8 }}
						>
							{companies.map((companyId, index) => {
								const isActive = companyId === activeCompany;
								const label = names[companyId] ?? companyId;
								return (
									<View key={companyId}>
										{index > 0 && (
											<Divider soft inset={64} />
										)}
										<TouchableOpacity
											onPress={() =>
												handleSelect(companyId)
											}
											disabled={switching}
											activeOpacity={0.7}
											style={{
												flexDirection: "row",
												alignItems: "center",
												gap: 14,
												paddingHorizontal: 12,
												paddingVertical: 14,
											}}
										>
											<Avatar
												name={label}
												size="md"
												fallbackIcon="business"
											/>
											<Text
												variant="body"
												weight={
													isActive
														? "semibold"
														: "normal"
												}
												style={{ flex: 1 }}
											>
												{label}
											</Text>
											{isActive && (
												<Icon
													name="check"
													size={20}
													color={theme.AccentStrong}
												/>
											)}
										</TouchableOpacity>
									</View>
								);
							})}
						</View>
					</SafeAreaView>
				</Pressable>
			</Pressable>
		</Modal>
	);
};
