import { useEffect, useMemo, useState } from "react";
import {
	deleteChecklist,
	deleteEventLabel,
	deletePackage,
	saveChecklist,
	saveEventLabel,
	savePackage,
	subscribeChecklists,
	subscribeEventLabels,
	subscribePackages,
} from "@app/services/libraryService";
import { showConfirmation } from "@app/utils/alertUtils";
import type { Checklist, EventLabel, Package } from "@app/types";
import { useCompany } from "../../contexts/CompanyContext";
import {
	Badge,
	Button,
	Card,
	EmptyState,
	Icon,
	Input,
	Text,
	useToast,
} from "../../ui";
import styles from "./LibraryPages.module.css";

/*
 * Checklists, packages and event labels.
 *
 * All three are the same shape — a company-owned list an admin curates — so
 * they share a two-pane layout: the list on the left, the selected item on the
 * right. The app puts each behind its own screen with a modal editor.
 *
 * Each page shows REVERSE USAGE where it can. "Delete this checklist" is a very
 * different decision when three packages depend on it, and the app does not say.
 */

/* ------------------------------------------------------------- checklists */

export function ChecklistsPage() {
	const { companyId } = useCompany();
	const toast = useToast();
	const [checklists, setChecklists] = useState<Checklist[]>([]);
	const [packages, setPackages] = useState<Package[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => subscribeChecklists(companyId, setChecklists), [companyId]);
	useEffect(() => subscribePackages(companyId, setPackages), [companyId]);

	const selected = checklists.find((c) => c.id === selectedId) ?? null;

	const usedBy = useMemo(
		() =>
			packages.filter((pkg) =>
				(pkg.checklistIds ?? []).includes(selectedId ?? ""),
			),
		[packages, selectedId],
	);

	async function create() {
		setBusy(true);
		try {
			const id = await saveChecklist(companyId, {
				title: "New checklist",
				items: [],
			});
			setSelectedId(id);
		} catch (error) {
			toast.error("Could not create", asMessage(error));
		} finally {
			setBusy(false);
		}
	}

	async function save(patch: Partial<Checklist>) {
		if (!selected) return;
		try {
			await saveChecklist(companyId, { ...selected, ...patch });
		} catch (error) {
			toast.error("Could not save", asMessage(error));
		}
	}

	function remove() {
		if (!selected) return;
		showConfirmation(
			`Delete “${selected.title}”?`,
			usedBy.length
				? `${usedBy.length} package${usedBy.length === 1 ? "" : "s"} reference this checklist and will lose it.`
				: "Events already using it keep their copy of the tick state.",
			() => {
				void (async () => {
					try {
						await deleteChecklist(selected.id);
						setSelectedId(null);
						toast.success("Checklist deleted");
					} catch (error) {
						toast.error("Could not delete", asMessage(error));
					}
				})();
			},
			"Delete",
			"destructive",
		);
	}

	return (
		<TwoPane
			title="Checklists"
			subtitle="Reusable task lists. Attach them to events through a package."
			items={checklists.map((c) => ({
				id: c.id,
				label: c.title,
				meta: `${c.items?.length ?? 0} item${c.items?.length === 1 ? "" : "s"}`,
			}))}
			selectedId={selectedId}
			onSelect={setSelectedId}
			onCreate={create}
			creating={busy}
			emptyTitle="No checklists yet"
			emptyHint="Create one, then bundle it into a package to attach to events."
		>
			{selected && (
				<div className={styles.editor}>
					<div className={styles.editorHead}>
						<Input
							value={selected.title}
							onChange={(e) =>
								setChecklists((current) =>
									current.map((c) =>
										c.id === selected.id
											? { ...c, title: e.target.value }
											: c,
									),
								)
							}
							onBlur={(e) => save({ title: e.target.value })}
							aria-label="Checklist title"
						/>
						<Button
							variant="ghost"
							size="small"
							icon="trash-outline"
							onClick={remove}
						>
							Delete
						</Button>
					</div>

					{usedBy.length > 0 && (
						<div className={styles.usage}>
							<Icon name="albums-outline" size="sm" />
							<Text variant="caption" as="span">
								Used by {usedBy.map((p) => p.title).join(", ")}
							</Text>
						</div>
					)}

					<ItemListEditor
						items={selected.items ?? []}
						onChange={(items) => void save({ items })}
					/>
				</div>
			)}
		</TwoPane>
	);
}

function ItemListEditor({
	items,
	onChange,
}: {
	items: { id: string; text: string }[];
	onChange: (items: { id: string; text: string }[]) => void;
}) {
	const [draft, setDraft] = useState("");

	return (
		<div className={styles.items}>
			<Text variant="overline" tone="tertiary">
				Items ({items.length})
			</Text>

			<ul className={styles.itemList}>
				{items.map((item, index) => (
					<li key={item.id} className={styles.itemRow}>
						<Icon
							name="ellipse-outline"
							size="xs"
							className={styles.dim}
						/>
						<Input
							value={item.text}
							onChange={(e) => {
								const next = [...items];
								next[index] = {
									...item,
									text: e.target.value,
								};
								onChange(next);
							}}
							aria-label={`Item ${index + 1}`}
						/>
						<button
							className={styles.removeButton}
							onClick={() =>
								onChange(items.filter((_, i) => i !== index))
							}
							aria-label="Remove item"
						>
							<Icon name="close" size="xs" />
						</button>
					</li>
				))}
			</ul>

			<Input
				icon="add"
				placeholder="Add an item and press Enter"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => {
					if (e.key !== "Enter") return;
					e.preventDefault();
					const text = draft.trim();
					if (!text) return;
					onChange([
						...items,
						{
							id: `i_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
							text,
						},
					]);
					setDraft("");
				}}
			/>
		</div>
	);
}

/* --------------------------------------------------------------- packages */

export function PackagesPage() {
	const { companyId } = useCompany();
	const toast = useToast();
	const [packages, setPackages] = useState<Package[]>([]);
	const [checklists, setChecklists] = useState<Checklist[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => subscribePackages(companyId, setPackages), [companyId]);
	useEffect(() => subscribeChecklists(companyId, setChecklists), [companyId]);

	const selected = packages.find((p) => p.id === selectedId) ?? null;

	const itemCount = useMemo(
		() =>
			(selected?.checklistIds ?? []).reduce(
				(sum, id) =>
					sum +
					(checklists.find((c) => c.id === id)?.items?.length ?? 0),
				0,
			),
		[selected, checklists],
	);

	async function create() {
		setBusy(true);
		try {
			const id = await savePackage(companyId, {
				title: "New package",
				description: "",
				checklistIds: [],
			});
			setSelectedId(id);
		} catch (error) {
			toast.error("Could not create", asMessage(error));
		} finally {
			setBusy(false);
		}
	}

	async function save(patch: Partial<Package>) {
		if (!selected) return;
		try {
			await savePackage(companyId, { ...selected, ...patch });
		} catch (error) {
			toast.error("Could not save", asMessage(error));
		}
	}

	return (
		<TwoPane
			title="Packages"
			subtitle="Bundles of checklists. Attaching a package to an event attaches all of its lists."
			items={packages.map((p) => ({
				id: p.id,
				label: p.title,
				meta: `${p.checklistIds?.length ?? 0} checklist${p.checklistIds?.length === 1 ? "" : "s"}`,
			}))}
			selectedId={selectedId}
			onSelect={setSelectedId}
			onCreate={create}
			creating={busy}
			emptyTitle="No packages yet"
			emptyHint="Group the checklists that always go together — a wedding kit, a truck load-out."
		>
			{selected && (
				<div className={styles.editor}>
					<div className={styles.editorHead}>
						<Input
							value={selected.title}
							onChange={(e) =>
								setPackages((current) =>
									current.map((p) =>
										p.id === selected.id
											? { ...p, title: e.target.value }
											: p,
									),
								)
							}
							onBlur={(e) => save({ title: e.target.value })}
							aria-label="Package title"
						/>
						<Button
							variant="ghost"
							size="small"
							icon="trash-outline"
							onClick={() =>
								showConfirmation(
									`Delete “${selected.title}”?`,
									"Events already using it keep their checklists.",
									() => {
										void deletePackage(selected.id)
											.then(() => {
												setSelectedId(null);
												toast.success(
													"Package deleted",
												);
											})
											.catch((error) =>
												toast.error(
													"Could not delete",
													asMessage(error),
												),
											);
									},
									"Delete",
									"destructive",
								)
							}
						>
							Delete
						</Button>
					</div>

					<Input
						label="Description"
						value={selected.description ?? ""}
						onChange={(e) =>
							setPackages((current) =>
								current.map((p) =>
									p.id === selected.id
										? { ...p, description: e.target.value }
										: p,
								),
							)
						}
						onBlur={(e) => save({ description: e.target.value })}
					/>

					<div className={styles.items}>
						<div className={styles.itemsHead}>
							<Text variant="overline" tone="tertiary">
								Checklists
							</Text>
							<Text variant="caption" tone="tertiary">
								{itemCount} items in total
							</Text>
						</div>

						{checklists.length === 0 ? (
							<Text variant="caption" tone="tertiary">
								No checklists to add yet.
							</Text>
						) : (
							<ul className={styles.checkList}>
								{checklists.map((checklist) => {
									const chosen = (
										selected.checklistIds ?? []
									).includes(checklist.id);
									return (
										<li key={checklist.id}>
											<label className={styles.checkRow}>
												<input
													type="checkbox"
													checked={chosen}
													onChange={() =>
														void save({
															checklistIds: chosen
																? (
																		selected.checklistIds ??
																		[]
																	).filter(
																		(id) =>
																			id !==
																			checklist.id,
																	)
																: [
																		...(selected.checklistIds ??
																			[]),
																		checklist.id,
																	],
														})
													}
												/>
												<Text variant="body" as="span">
													{checklist.title}
												</Text>
												<Badge tone="neutral">
													{checklist.items?.length ??
														0}
												</Badge>
											</label>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</div>
			)}
		</TwoPane>
	);
}

/* ----------------------------------------------------------------- labels */

const SWATCHES = [
	"#6B8A2E",
	"#3F8F4F",
	"#B7791F",
	"#C0392B",
	"#5A7526",
	"#2F3B16",
	"#4A6120",
	"#878C81",
];

export function LabelsPage() {
	const { companyId } = useCompany();
	const toast = useToast();
	const [labels, setLabels] = useState<EventLabel[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => subscribeEventLabels(companyId, setLabels), [companyId]);

	const selected = labels.find((l) => l.id === selectedId) ?? null;

	async function create() {
		setBusy(true);
		try {
			const id = await saveEventLabel(companyId, {
				name: "New label",
				color: SWATCHES[labels.length % SWATCHES.length],
			});
			setSelectedId(id);
		} catch (error) {
			toast.error("Could not create", asMessage(error));
		} finally {
			setBusy(false);
		}
	}

	async function save(patch: Partial<EventLabel>) {
		if (!selected) return;
		try {
			await saveEventLabel(companyId, { ...selected, ...patch });
		} catch (error) {
			toast.error("Could not save", asMessage(error));
		}
	}

	return (
		<TwoPane
			title="Event labels"
			subtitle="Colour-coding for the calendar. Labels are the only user-chosen colour in the app."
			items={labels.map((l) => ({
				id: l.id,
				label: l.name,
				meta: l.color,
				color: l.color,
			}))}
			selectedId={selectedId}
			onSelect={setSelectedId}
			onCreate={create}
			creating={busy}
			emptyTitle="No labels yet"
			emptyHint="Create a few — weddings, corporate, deliveries — to colour the calendar."
		>
			{selected && (
				<div className={styles.editor}>
					<div className={styles.editorHead}>
						<Input
							value={selected.name}
							onChange={(e) =>
								setLabels((current) =>
									current.map((l) =>
										l.id === selected.id
											? { ...l, name: e.target.value }
											: l,
									),
								)
							}
							onBlur={(e) => save({ name: e.target.value })}
							aria-label="Label name"
						/>
						<Button
							variant="ghost"
							size="small"
							icon="trash-outline"
							onClick={() =>
								showConfirmation(
									`Delete “${selected.name}”?`,
									"Events using it lose their colour but are otherwise untouched.",
									() => {
										void deleteEventLabel(selected.id)
											.then(() => {
												setSelectedId(null);
												toast.success("Label deleted");
											})
											.catch((error) =>
												toast.error(
													"Could not delete",
													asMessage(error),
												),
											);
									},
									"Delete",
									"destructive",
								)
							}
						>
							Delete
						</Button>
					</div>

					<div className={styles.items}>
						<Text variant="overline" tone="tertiary">
							Colour
						</Text>
						<div className={styles.swatches}>
							{SWATCHES.map((color) => (
								<button
									key={color}
									className={[
										styles.swatch,
										selected.color === color
											? styles.swatchActive
											: "",
									]
										.filter(Boolean)
										.join(" ")}
									style={{ background: color }}
									onClick={() => void save({ color })}
									aria-label={color}
								/>
							))}
							<input
								type="color"
								className={styles.colorInput}
								value={selected.color}
								onChange={(e) =>
									void save({ color: e.target.value })
								}
								aria-label="Custom colour"
							/>
						</div>

						<Text variant="overline" tone="tertiary">
							On a calendar chip
						</Text>
						<div className={styles.chipPreview}>
							<span
								className={styles.previewChip}
								style={{ borderLeftColor: selected.color }}
							>
								<span className={styles.previewTime}>
									18:00
								</span>
								<span>Example event</span>
							</span>
							<Badge color={selected.color} dot>
								{selected.name}
							</Badge>
						</div>
					</div>
				</div>
			)}
		</TwoPane>
	);
}

/* ---------------------------------------------------------- shared shell */

function TwoPane({
	title,
	subtitle,
	items,
	selectedId,
	onSelect,
	onCreate,
	creating,
	emptyTitle,
	emptyHint,
	children,
}: {
	title: string;
	subtitle: string;
	items: { id: string; label: string; meta: string; color?: string }[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	onCreate: () => void;
	creating: boolean;
	emptyTitle: string;
	emptyHint: string;
	children: React.ReactNode;
}) {
	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div>
					<Text variant="display" as="h1">
						{title}
					</Text>
					<Text variant="caption" tone="secondary">
						{subtitle}
					</Text>
				</div>
				<Button
					variant="primary"
					icon="add"
					onClick={onCreate}
					busy={creating}
				>
					New
				</Button>
			</header>

			<div className={styles.panes}>
				<Card flush className={styles.listPane}>
					{items.length === 0 ? (
						<EmptyState
							icon="albums-outline"
							title={emptyTitle}
							description={emptyHint}
						/>
					) : (
						<ul className={styles.list}>
							{items.map((item) => (
								<li key={item.id}>
									<button
										className={[
											styles.row,
											item.id === selectedId
												? styles.rowActive
												: "",
										]
											.filter(Boolean)
											.join(" ")}
										onClick={() => onSelect(item.id)}
									>
										{item.color && (
											<span
												className={styles.dot}
												style={{
													background: item.color,
												}}
											/>
										)}
										<span className={styles.rowMain}>
											<Text
												variant="bodyStrong"
												as="span"
												clamp={1}
											>
												{item.label}
											</Text>
											<Text
												variant="caption"
												tone="tertiary"
												as="span"
											>
												{item.meta}
											</Text>
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</Card>

				<Card className={styles.detailPane}>
					{children ?? (
						<EmptyState
							icon="albums-outline"
							title="Nothing selected"
							description="Pick one on the left, or create a new one."
						/>
					)}
				</Card>
			</div>
		</div>
	);
}

const asMessage = (error: unknown) =>
	error instanceof Error ? error.message : undefined;
