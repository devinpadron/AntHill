import { virtualFiles } from "./rn-fs";

/*
 * Stands in for `react-native-html-to-pdf`.
 *
 * exportService builds a full HTML document for the payroll PDF and hands it to
 * this converter. There is no browser API that turns HTML into a PDF file
 * directly — but every browser already has one that turns HTML into a PDF the
 * user chooses where to put: print.
 *
 * So this stores the HTML under a virtual path and returns it. The caller
 * (web/src/lib/download.ts) renders it into a hidden same-origin iframe and
 * calls print(); "Save as PDF" is the destination. That keeps exportService's
 * ~300 lines of HTML templating identical between the two clients and adds zero
 * dependencies.
 */

export type ConvertOptions = {
	html: string;
	fileName?: string;
	directory?: string;
	base64?: boolean;
	width?: number;
	height?: number;
};

export type ConvertResult = {
	filePath: string;
	base64: string;
};

const RNHTMLtoPDF = {
	async convert({
		html,
		fileName = "document",
	}: ConvertOptions): Promise<ConvertResult> {
		// .html rather than .pdf: it is what this actually holds, and
		// download.ts branches on the extension to decide print-vs-download.
		const filePath = `/virtual/${fileName}.html`;
		virtualFiles.set(filePath, html);
		return { filePath, base64: "" };
	},
};

export default RNHTMLtoPDF;
