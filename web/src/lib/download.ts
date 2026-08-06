import { virtualFiles } from "../shim/rn-fs";

/*
 * The web end of the export path.
 *
 * ../../src/services/exportService.ts — ~620 lines of CSV assembly and HTML
 * templating — is reused VERBATIM. It writes its output through react-native-fs,
 * which the shim turns into an in-memory map keyed by the path exportService
 * invented. These helpers read it back out.
 *
 * The only thing NOT reused is `shareFile`, which opens a native share sheet.
 * On the web the download IS the share.
 *
 * That split is deliberate: an export format is exactly the kind of thing that
 * silently diverges between two clients, and a payroll CSV that disagrees with
 * the app's is worse than no export at all. The column order, the header row,
 * the connected-event handling and the duration formatting all come from the
 * same code the phone runs.
 */

const MIME: Record<string, string> = {
	csv: "text/csv;charset=utf-8",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	html: "text/html;charset=utf-8",
	pdf: "application/pdf",
};

function takeVirtual(path: string): string {
	const contents = virtualFiles.get(path);
	if (contents === undefined) {
		throw new Error(`Nothing was written to ${path}`);
	}
	virtualFiles.delete(path); // one-shot; don't accumulate megabytes of CSV
	return contents;
}

/** Downloads whatever exportService wrote at `path`. */
export function downloadVirtualFile(path: string, fileName?: string): void {
	const contents = takeVirtual(path);
	const extension = path.split(".").pop()?.toLowerCase() ?? "csv";
	const blob = new Blob([contents], {
		type: MIME[extension] ?? "application/octet-stream",
	});

	const url = URL.createObjectURL(blob);
	const anchor = Object.assign(document.createElement("a"), {
		href: url,
		download: fileName ?? path.split("/").pop() ?? "export",
	});
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	// Revoked on the next tick — revoking synchronously can beat the download
	// in Safari.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Prints the HTML exportService generated, so the browser's "Save as PDF"
 * produces the file.
 *
 * There is no browser API that turns HTML into a PDF, but every browser already
 * has one that turns HTML into a PDF the user chooses where to put. This keeps
 * the ~300 lines of PDF templating identical between clients and adds zero
 * dependencies.
 *
 * A print stylesheet is injected because the source HTML was written for
 * react-native-html-to-pdf's renderer, which paginates differently.
 */
export function printVirtualFile(path: string): void {
	const html = takeVirtual(path);

	const frame = document.createElement("iframe");
	frame.setAttribute("aria-hidden", "true");
	frame.style.cssText =
		"position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
	document.body.appendChild(frame);

	const doc = frame.contentDocument;
	if (!doc) {
		frame.remove();
		throw new Error("Could not open a print frame");
	}

	doc.open();
	doc.write(html);
	doc.write(`
		<style>
			@page { margin: 12mm; }
			@media print {
				/* Keep a shift's rows together across a page break, and repeat
				   the header — the native renderer did both implicitly. */
				table { page-break-inside: auto; }
				tr { page-break-inside: avoid; page-break-after: auto; }
				thead { display: table-header-group; }
				body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
			}
		</style>
	`);
	doc.close();

	const run = () => {
		frame.contentWindow?.focus();
		frame.contentWindow?.print();
		// Left in place briefly: removing the frame during the print dialog
		// cancels the job in Chrome.
		setTimeout(() => frame.remove(), 60_000);
	};

	if (doc.readyState === "complete") run();
	else frame.onload = run;
}

/** Tab-separated, for pasting straight into a spreadsheet. A desktop nicety. */
export async function copyAsTsv(path: string): Promise<void> {
	const csv = takeVirtual(path);
	const tsv = csv
		.split("\n")
		.map((line) =>
			// Split on commas outside quotes, then unquote.
			(line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? [])
				.map((cell) =>
					cell
						.replace(/,$/, "")
						.replace(/^"|"$/g, "")
						.replace(/""/g, '"'),
				)
				.join("\t"),
		)
		.join("\n");
	await navigator.clipboard.writeText(tsv);
}
