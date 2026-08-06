/*
 * Stands in for `react-native-fs`, so src/services/exportService.ts — ~620
 * lines of CSV assembly and HTML templating — can be reused byte-for-byte
 * instead of reimplemented. Two copies of an export format is how the two
 * clients start disagreeing about what an hour is.
 *
 * There is no filesystem in a browser, so writeFile captures the content in
 * memory against the path exportService invented. web/src/lib/download.ts then
 * reads it back out and hands the user a Blob. The path is a token, not a
 * location.
 *
 * Entries are removed on download; anything abandoned is cleared by
 * clearVirtualFiles() when a page unmounts, so a long session cannot
 * accumulate megabytes of stale CSV.
 */

export const virtualFiles = new Map<string, string>();

export function clearVirtualFiles(): void {
	virtualFiles.clear();
}

const RNFS = {
	DocumentDirectoryPath: "/virtual",
	CachesDirectoryPath: "/virtual",
	TemporaryDirectoryPath: "/virtual",

	async writeFile(
		filePath: string,
		contents: string,
		_encoding?: string,
	): Promise<void> {
		virtualFiles.set(filePath, contents);
	},

	async readFile(filePath: string, _encoding?: string): Promise<string> {
		const contents = virtualFiles.get(filePath);
		if (contents === undefined) {
			throw new Error(`No virtual file at ${filePath}`);
		}
		return contents;
	},

	async exists(filePath: string): Promise<boolean> {
		return virtualFiles.has(filePath);
	},

	async unlink(filePath: string): Promise<void> {
		virtualFiles.delete(filePath);
	},

	async mkdir(): Promise<void> {},
};

export default RNFS;
