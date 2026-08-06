import { useEffect, useRef } from "react";
import type { Event, EventResponseStatus, Membership } from "@app/types";
import { Badge, Icon, Text } from "../../ui";
import type { Cell } from "./useStaffingBoard";
import styles from "./CellPopover.module.css";

/*
 * One cell, opened.
 *
 * Deliberately small: four statuses and an assign toggle. The board's job is to
 * let an admin work down a month quickly, and a popover that asks a second
 * question defeats that — anything richer belongs in the event drawer, which is
 * one click away.
 *
 * When the worker cannot see the event, that is said plainly and the response
 * actions still work: a manager answering on someone's behalf is exactly how
 * you resolve "they were never invited but they are working it".
 */

const OPTIONS: {
	value: EventResponseStatus;
	label: string;
	tone: "success" | "warning" | "danger";
	key: string;
}[] = [
	{ value: "confirmed", label: "Confirmed", tone: "success", key: "C" },
	{ value: "pending", label: "No answer", tone: "warning", key: "P" },
	{ value: "declined", label: "Declined", tone: "danger", key: "D" },
];

export function CellPopover({
	anchor,
	member,
	event,
	cell,
	onSet,
	onToggleAssign,
	onClose,
}: {
	anchor: DOMRect;
	member: Membership;
	event: Event;
	cell: Cell;
	onSet: (status: EventResponseStatus) => void;
	onToggleAssign: () => void;
	onClose: () => void;
}) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		ref.current?.focus();
	}, []);

	// Flip above / left when the cell is near the viewport edge, so a popover
	// on the last column or bottom row is not half off-screen.
	const width = 240;
	const height = 260;
	const left = Math.min(anchor.left, window.innerWidth - width - 16);
	const top =
		anchor.bottom + height > window.innerHeight
			? Math.max(16, anchor.top - height)
			: anchor.bottom + 4;

	return (
		<>
			<div className={styles.backdrop} onClick={onClose} />
			<div
				ref={ref}
				className={styles.popover}
				style={{ left, top, width }}
				role="dialog"
				aria-label="Set response"
				tabIndex={-1}
				onKeyDown={(e) => {
					if (e.key === "Escape") onClose();
				}}
			>
				<div className={styles.head}>
					<Text variant="bodyStrong" clamp={1}>
						{member.firstName} {member.lastName}
					</Text>
					<Text variant="caption" tone="secondary" clamp={1}>
						{event.title}
					</Text>
				</div>

				{cell.state === "not-visible" && (
					<div className={styles.notice}>
						<Icon name="lock-closed-outline" size="xs" />
						<Text variant="caption" as="span">
							They cannot see this event — restricted, and not in
							its audience.
						</Text>
					</div>
				)}

				{cell.conflict && (
					<div className={styles.warn}>
						<Icon name="warning" size="xs" />
						<Text variant="caption" as="span">
							Already booked elsewhere that day.
						</Text>
					</div>
				)}

				<div className={styles.options}>
					{OPTIONS.map((option) => (
						<button
							key={option.value}
							className={[
								styles.option,
								cell.state === option.value
									? styles.optionActive
									: "",
							]
								.filter(Boolean)
								.join(" ")}
							onClick={() => onSet(option.value)}
						>
							<Badge tone={option.tone} dot>
								{option.label}
							</Badge>
							<kbd className={styles.key}>{option.key}</kbd>
						</button>
					))}
				</div>

				<button className={styles.assign} onClick={onToggleAssign}>
					<Icon
						name={
							cell.assigned
								? "close-circle"
								: "add-circle-outline"
						}
						size="sm"
					/>
					<Text variant="body" as="span">
						{cell.assigned ? "Remove from crew" : "Add to crew"}
					</Text>
					<kbd className={styles.key}>A</kbd>
				</button>
			</div>
		</>
	);
}
