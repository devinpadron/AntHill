import { useState } from "react";
import {
	exportTimeEntriesToCSV,
	exportTimeEntriesToPDF,
} from "@app/services/exportService";
import type { Membership, TimeEntry } from "@app/types";
import { useCompany } from "../../contexts/CompanyContext";
import { Button, Icon, Text, useToast } from "../../ui";
import {
	copyAsTsv,
	downloadVirtualFile,
	printVirtualFile,
} from "../../lib/download";
import styles from "./ExportMenu.module.css";

/*
 * Export.
 *
 * The generation itself is ../../src/services/exportService.ts, reused
 * unchanged — the same column order, header row, connected-event handling and
 * duration formatting the phone produces. It writes through react-native-fs,
 * which the shim redirects into memory; these buttons read it back out.
 *
 * That matters more than it looks. An export format is exactly the kind of
 * thing that quietly diverges between two clients, and a payroll CSV that
 * disagrees with the app's is worse than having no export.
 */
export function ExportMenu({
	entries,
	employee,
	label,
}: {
	entries: TimeEntry[];
	/** Named on the PDF header. Omit for a whole-company export. */
	employee?: Membership | null;
	/** Goes into the filename — usually the period. */
	label: string;
}) {
	const { companyId } = useCompany();
	const toast = useToast();
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);

	const fileName = [
		"anthill",
		employee ? `${employee.lastName}-${employee.firstName}` : "all",
		label.replace(/[^\w-]+/g, "-"),
	]
		.join("_")
		.toLowerCase();

	async function run(kind: "csv" | "excel" | "tsv" | "pdf") {
		if (!entries.length) {
			toast.warning("Nothing to export", "No entries in this selection.");
			return;
		}
		setBusy(kind);
		setOpen(false);
		try {
			if (kind === "pdf") {
				const path = await exportTimeEntriesToPDF(
					entries,
					employee ?? null,
					companyId,
					fileName,
				);
				printVirtualFile(path);
				toast.info(
					"Opening the print dialog",
					"Choose “Save as PDF” as the destination.",
				);
				return;
			}

			const path = await exportTimeEntriesToCSV(
				entries,
				fileName,
				kind === "excel",
			);

			if (kind === "tsv") {
				await copyAsTsv(path);
				toast.success("Copied", "Paste straight into Sheets or Excel.");
				return;
			}

			downloadVirtualFile(path);
			toast.success(`${entries.length} entries exported`);
		} catch (error) {
			toast.error(
				"Export failed",
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setBusy(null);
		}
	}

	return (
		<div className={styles.wrap}>
			<Button
				variant="secondary"
				size="small"
				icon="download-outline"
				onClick={() => setOpen((v) => !v)}
				busy={Boolean(busy)}
				aria-expanded={open}
			>
				Export
			</Button>

			{open && (
				<>
					<div
						className={styles.backdrop}
						onClick={() => setOpen(false)}
					/>
					<div className={styles.menu} role="menu">
						<Text variant="overline" tone="tertiary">
							{entries.length} entr
							{entries.length === 1 ? "y" : "ies"}
						</Text>

						<MenuItem
							icon="document-text-outline"
							title="CSV"
							hint="Same format as the app"
							onClick={() => run("csv")}
						/>
						<MenuItem
							icon="grid-outline"
							title="Excel CSV"
							hint="UTF-8 BOM, opens cleanly in Excel"
							onClick={() => run("excel")}
						/>
						<MenuItem
							icon="copy-outline"
							title="Copy as TSV"
							hint="Paste into a spreadsheet"
							onClick={() => run("tsv")}
						/>
						<MenuItem
							icon="print-outline"
							title="PDF"
							hint="Opens print — choose Save as PDF"
							onClick={() => run("pdf")}
						/>
					</div>
				</>
			)}
		</div>
	);
}

function MenuItem({
	icon,
	title,
	hint,
	onClick,
}: {
	icon:
		| "document-text-outline"
		| "grid-outline"
		| "copy-outline"
		| "print-outline";
	title: string;
	hint: string;
	onClick: () => void;
}) {
	return (
		<button className={styles.item} onClick={onClick} role="menuitem">
			<Icon name={icon} size="sm" className={styles.dim} />
			<span className={styles.itemText}>
				<Text variant="body" as="span">
					{title}
				</Text>
				<Text variant="caption" tone="tertiary" as="span">
					{hint}
				</Text>
			</span>
		</button>
	);
}
