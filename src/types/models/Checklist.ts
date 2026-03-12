export interface ChecklistItem {
	id: string;
	text: string;
}

export interface Checklist {
	id: string;
	title: string;
	items: ChecklistItem[];
}

/** State map: { [checklistId]: { [itemId]: 0 | 1 | 2 } } */
export type ChecklistItemStates = Record<string, Record<string, number>>;
