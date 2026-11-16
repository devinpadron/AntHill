import { useEffect, useMemo, useState } from "react";
import { subscribeTaskTemplates } from "../services/eventTaskService";
import { TaskTemplate } from "../types";

/*
 * The company's task library, live.
 *
 * Shared by the library editor, the package editor and the event form, which
 * is why it is a hook: three screens opening the same subscription by hand is
 * how the checklist and package pickers ended up with three slightly different
 * loading states.
 */
export function useTaskTemplates(companyId: string) {
	const [templates, setTemplates] = useState<TaskTemplate[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!companyId) {
			setTemplates([]);
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		return subscribeTaskTemplates(companyId, (next) => {
			setTemplates(next);
			setIsLoading(false);
		});
	}, [companyId]);

	const byId = useMemo(
		() => Object.fromEntries(templates.map((t) => [t.id, t])),
		[templates],
	);

	return { templates, byId, isLoading };
}
