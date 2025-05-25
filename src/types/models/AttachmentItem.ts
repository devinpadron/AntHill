export interface AttachmentItem {
	id: string;
	uri: string;
	name: string;
	type: string;
	size: number;
	width?: number;
	height?: number;
	isExisting: boolean;
	thumbnailUri?: string | null;
	downloadUrl?: string | null;
	thumbnailUrl?: string | null;
}
