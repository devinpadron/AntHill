import { useMemo, useState } from "react";
import { MAX_SELECTED_USERS } from "@app/services/eventService";
import { FilterType } from "@app/types/enums/FilterType";
import type { EventLabel, Membership } from "@app/types";
import { Badge, Icon, Input, Text } from "../../ui";
import styles from "./FilterRail.module.css";

/*
 * Everything the app's FilterPanel hides behind a bottom sheet, permanently on
 * screen.
 *
 * On the phone, choosing "specific workers" means opening a sheet, picking, and
 * closing it — so the filter that produced the current view is invisible while
 * you look at the view. On a desktop there is room to keep it beside the
 * calendar, which means an admin can always see WHY they are looking at these
 * events.
 *
 * The four filter modes and the two refinement toggles map exactly onto
 * eventService: FilterType drives `buildQuery`'s server-side branch, and
 * allSelected/exactSelected drive `refineSelection`, which narrows the result
 * in JS because Firestore cannot express "assigned to all of these".
 */

export type CalendarFilters = {
	filterType: FilterType;
	selectedUsers: string[];
	allSelected: boolean;
	exactSelected: boolean;
	labelIds: string[];
	unstaffedOnly: boolean;
	pendingOnly: boolean;
};

export const DEFAULT_FILTERS: CalendarFilters = {
	filterType: FilterType.ALL,
	selectedUsers: [],
	allSelected: false,
	exactSelected: false,
	labelIds: [],
	unstaffedOnly: false,
	pendingOnly: false,
};

const MODES: { value: FilterType; label: string; hint: string }[] = [
	{ value: FilterType.ALL, label: "All", hint: "Every event in the window" },
	{
		value: FilterType.MY,
		label: "Mine",
		hint: "Events you are assigned to",
	},
	{
		value: FilterType.UNASSIGNED,
		label: "Unstaffed",
		hint: "Events with nobody assigned yet",
	},
	{
		value: FilterType.SPECIFIC,
		label: "By worker",
		hint: "Events assigned to the workers you pick",
	},
];

export function FilterRail({
	filters,
	onChange,
	members,
	labels,
}: {
	filters: CalendarFilters;
	onChange: (next: CalendarFilters) => void;
	members: Membership[];
	labels: EventLabel[];
}) {
	const [search, setSearch] = useState("");

	const patch = (next: Partial<CalendarFilters>) =>
		onChange({ ...filters, ...next });

	const visibleMembers = useMemo(() => {
		const needle = search.trim().toLowerCase();
		if (!needle) return members;
		return members.filter((member) =>
			`${member.firstName} ${member.lastName}`
				.toLowerCase()
				.includes(needle),
		);
	}, [members, search]);

	const atCap = filters.selectedUsers.length >= MAX_SELECTED_USERS;

	function toggleUser(userId: string) {
		const chosen = filters.selectedUsers.includes(userId);
		if (!chosen && atCap) return;
		patch({
			selectedUsers: chosen
				? filters.selectedUsers.filter((id) => id !== userId)
				: [...filters.selectedUsers, userId],
			// Picking a worker only means anything in SPECIFIC mode, so switch
			// into it rather than silently changing nothing.
			filterType: chosen ? filters.filterType : FilterType.SPECIFIC,
		});
	}

	return (
		<aside className={styles.rail} aria-label="Calendar filters">
			<section className={styles.section}>
				<Text variant="overline" tone="tertiary">
					Show
				</Text>
				<div className={styles.modes}>
					{MODES.map((mode) => (
						<button
							key={mode.value}
							className={[
								styles.mode,
								filters.filterType === mode.value
									? styles.modeActive
									: "",
							]
								.filter(Boolean)
								.join(" ")}
							onClick={() => patch({ filterType: mode.value })}
							title={mode.hint}
							aria-pressed={filters.filterType === mode.value}
						>
							{mode.label}
						</button>
					))}
				</div>
			</section>

			<section className={styles.section}>
				<div className={styles.sectionHead}>
					<Text variant="overline" tone="tertiary">
						Workers
					</Text>
					{filters.selectedUsers.length > 0 && (
						<button
							className={styles.clear}
							onClick={() =>
								patch({
									selectedUsers: [],
									allSelected: false,
									exactSelected: false,
									filterType: FilterType.ALL,
								})
							}
						>
							Clear
						</button>
					)}
				</div>

				<Input
					icon="search"
					placeholder="Find a worker"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>

				{atCap && (
					<Text variant="caption" tone="warning">
						{MAX_SELECTED_USERS} is the most Firestore can filter on
						at once.
					</Text>
				)}

				<ul className={styles.workerList}>
					{visibleMembers.map((member) => {
						const chosen = filters.selectedUsers.includes(
							member.userId,
						);
						return (
							<li key={member.id}>
								<label
									className={[
										styles.workerRow,
										!chosen && atCap
											? styles.workerRowDisabled
											: "",
									]
										.filter(Boolean)
										.join(" ")}
								>
									<input
										type="checkbox"
										checked={chosen}
										disabled={!chosen && atCap}
										onChange={() =>
											toggleUser(member.userId)
										}
									/>
									<Text variant="body" as="span" clamp={1}>
										{member.firstName} {member.lastName}
									</Text>
								</label>
							</li>
						);
					})}
				</ul>

				{/*
				 * The two refinements Firestore cannot express. They only make
				 * sense with more than one worker picked, so they stay hidden
				 * until then rather than sitting there doing nothing.
				 */}
				{filters.selectedUsers.length > 1 && (
					<div className={styles.refinements}>
						<label className={styles.checkRow}>
							<input
								type="checkbox"
								checked={filters.allSelected}
								onChange={(e) =>
									patch({
										allSelected: e.target.checked,
										exactSelected: false,
									})
								}
							/>
							<span>
								<Text variant="body" as="span">
									All of them
								</Text>
								<Text
									variant="caption"
									tone="tertiary"
									as="span"
								>
									Every worker picked is on the event
								</Text>
							</span>
						</label>
						<label className={styles.checkRow}>
							<input
								type="checkbox"
								checked={filters.exactSelected}
								onChange={(e) =>
									patch({
										exactSelected: e.target.checked,
										allSelected: false,
									})
								}
							/>
							<span>
								<Text variant="body" as="span">
									Exactly them
								</Text>
								<Text
									variant="caption"
									tone="tertiary"
									as="span"
								>
									That crew and nobody else
								</Text>
							</span>
						</label>
					</div>
				)}
			</section>

			{labels.length > 0 && (
				<section className={styles.section}>
					<div className={styles.sectionHead}>
						<Text variant="overline" tone="tertiary">
							Labels
						</Text>
						{filters.labelIds.length > 0 && (
							<button
								className={styles.clear}
								onClick={() => patch({ labelIds: [] })}
							>
								Clear
							</button>
						)}
					</div>
					<div className={styles.labels}>
						{labels.map((label) => {
							const chosen = filters.labelIds.includes(label.id);
							return (
								<button
									key={label.id}
									onClick={() =>
										patch({
											labelIds: chosen
												? filters.labelIds.filter(
														(id) => id !== label.id,
													)
												: [
														...filters.labelIds,
														label.id,
													],
										})
									}
									className={styles.labelChip}
									aria-pressed={chosen}
								>
									<Badge
										color={label.color}
										dot
										icon={chosen ? "checkmark" : undefined}
									>
										{label.name}
									</Badge>
								</button>
							);
						})}
					</div>
				</section>
			)}

			<section className={styles.section}>
				<Text variant="overline" tone="tertiary">
					Needs attention
				</Text>
				<label className={styles.checkRow}>
					<input
						type="checkbox"
						checked={filters.unstaffedOnly}
						onChange={(e) =>
							patch({ unstaffedOnly: e.target.checked })
						}
					/>
					<span>
						<Text variant="body" as="span">
							Understaffed
						</Text>
						<Text variant="caption" tone="tertiary" as="span">
							Nobody assigned yet
						</Text>
					</span>
				</label>
				<label className={styles.checkRow}>
					<input
						type="checkbox"
						checked={filters.pendingOnly}
						onChange={(e) =>
							patch({ pendingOnly: e.target.checked })
						}
					/>
					<span>
						<Text variant="body" as="span">
							Awaiting replies
						</Text>
						<Text variant="caption" tone="tertiary" as="span">
							Someone was invited and has not answered
						</Text>
					</span>
				</label>
			</section>

			{isFiltered(filters) && (
				<button
					className={styles.resetAll}
					onClick={() => onChange(DEFAULT_FILTERS)}
				>
					<Icon name="close-circle" size="sm" />
					Reset all filters
				</button>
			)}
		</aside>
	);
}

export function isFiltered(filters: CalendarFilters): boolean {
	return (
		filters.filterType !== FilterType.ALL ||
		filters.selectedUsers.length > 0 ||
		filters.labelIds.length > 0 ||
		filters.unstaffedOnly ||
		filters.pendingOnly
	);
}
