import { useCallback, useEffect, useState } from "react";
import {
	completeEventTask,
	reopenEventTask,
	subscribeEventTasks,
} from "../services/eventTaskService";
import { EventTask } from "../types";

/*
 * The tasks on one event, and the two things anyone can do to one.
 *
 * Takes `companyId` and `userId` as arguments instead of reading them from
 * context, so the portal's event drawer can use this hook as it is — the app's
 * contexts carry @react-native-firebase/auth and AsyncStorage, which is the
 * reason useEventDrawer had to be a rewrite of useEventDetails rather than a
 * reuse.
 *
 * `complete` and `reopen` return nothing and do not throw: the service queues
 * the write and the subscription above redraws from the local snapshot at
 * once, online or not. A rejected write surfaces through pendingWrites.
 */
export function useEventTasks(
	companyId: string,
	eventId: string,
	userId: string,
) {
	const [tasks, setTasks] = useState<EventTask[]>([]);

	useEffect(() => {
		if (!companyId || !eventId) {
			setTasks([]);
			return;
		}
		return subscribeEventTasks(companyId, eventId, setTasks);
	}, [companyId, eventId]);

	/**
	 * `forUserId` defaults to the signed-in user. A manager passes someone
	 * else's id to tick it on their behalf; the completion records both.
	 */
	const complete = useCallback(
		(task: EventTask, note = "", forUserId?: string) => {
			if (!userId) return;
			completeEventTask(task, forUserId ?? userId, userId, note);
		},
		[userId],
	);

	const reopen = useCallback(
		(task: EventTask, forUserId?: string) => {
			if (!userId) return;
			reopenEventTask(task, forUserId ?? userId);
		},
		[userId],
	);

	return { tasks, complete, reopen };
}
