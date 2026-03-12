import { useState, useEffect } from "react";
import { getEventLabel } from "../../services/eventService";

/**
 * useEventLabel - Fetches the label data for an event
 *
 * @param labelId - The label ID from the event
 * @param companyId - The current company ID
 * @returns The event label object or null
 */
export const useEventLabel = (
	labelId: string | undefined,
	companyId: string,
) => {
	const [eventLabel, setEventLabel] = useState<{
		id: string;
		name: string;
		color: string;
	} | null>(null);

	useEffect(() => {
		if (!labelId || !companyId) {
			setEventLabel(null);
			return;
		}

		const fetchLabel = async () => {
			try {
				const label = await getEventLabel(companyId, labelId);
				setEventLabel(label);
			} catch (error) {
				console.error("Error fetching label:", error);
			}
		};

		fetchLabel();
	}, [labelId, companyId]);

	return { eventLabel };
};
