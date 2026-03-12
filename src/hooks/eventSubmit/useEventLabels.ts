import { useState, useEffect } from "react";
import { getEventLabels, getEventLabelId } from "../../services/eventService";

export const useEventLabels = (companyId: string, eventId?: string) => {
	const [availableLabels, setAvailableLabels] = useState<
		{ id: string; name: string; color: string }[]
	>([]);
	const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
	const [loadingLabels, setLoadingLabels] = useState(false);

	useEffect(() => {
		if (!companyId) return;

		const fetchLabels = async () => {
			setLoadingLabels(true);
			try {
				const labels = await getEventLabels(companyId);
				setAvailableLabels(labels);

				if (eventId) {
					const labelId = await getEventLabelId(companyId, eventId);
					if (labelId) setSelectedLabelId(labelId);
				}
			} catch (error) {
				console.error("Error fetching labels:", error);
			} finally {
				setLoadingLabels(false);
			}
		};

		fetchLabels();
	}, [companyId, eventId]);

	return {
		availableLabels,
		selectedLabelId,
		setSelectedLabelId,
		loadingLabels,
	};
};
