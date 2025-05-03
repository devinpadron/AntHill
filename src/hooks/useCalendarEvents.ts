// import { useState, useEffect, useCallback } from "react";
// import { subscribeEvents } from "../services/eventService";
// import {
// 	getAgendaItems,
// 	getMarkedDates,
// 	AgendaItem,
// } from "../services/agendaItemService";
// import { FilterType } from "../types/enums/FilterType";

// export const useCalendarEvents = (
// 	filterType: FilterType,
// 	companyId: string | undefined,
// 	userId: string,
// 	userPrivilege: string,
// 	selectedUsers: string[],
// 	showAllSelectedOnly: boolean,
// 	showExactSelectedOnly: boolean
// ) => {
// 	const [agendaItems, setAgendaItems] = useState<AgendaItem>({});
// 	const [markedDates, setMarkedDates] = useState({});
// 	const [refreshKey, setRefreshKey] = useState(0);

// 	const handleEventsUpdate = useCallback((snapshot: { docs: any }) => {
// 		const events = snapshot.docs;
// 		const items = getAgendaItems(events);
// 		const marks = getMarkedDates(items);
// 		setAgendaItems(items);
// 		setMarkedDates(marks);
// 		setRefreshKey((prev) => prev + 1);
// 	}, []);

// 	const refreshAgenda = useCallback(async () => {
// 		setRefreshKey((prev) => prev + 1);
// 		return Promise.resolve();
// 	}, []);

// 	useEffect(() => {
// 		if (!companyId || !userId) return;

// 		let userIds = [userId];
// 		let unsubscribe: (() => void) | undefined;

// 		if (userPrivilege !== "Admin" && userPrivilege !== "Owner") {
// 			unsubscribe = subscribeEvents(
// 				filterType,
// 				companyId,
// 				userIds,
// 				handleEventsUpdate
// 			);
// 		} else if (filterType === "specific") {
// 			userIds = selectedUsers.length > 0 ? selectedUsers : [userId];
// 			const filterOptions = {
// 				requireAllSelected: showAllSelectedOnly,
// 				exactMatchOnly: showExactSelectedOnly,
// 			};
// 			unsubscribe = subscribeEvents(
// 				filterType,
// 				companyId,
// 				userIds,
// 				handleEventsUpdate,
// 				filterOptions
// 			);
// 		} else {
// 			userIds =
// 				filterType === "unassigned" || filterType === "all"
// 					? []
// 					: userIds;
// 			unsubscribe = subscribeEvents(
// 				filterType,
// 				companyId,
// 				userIds,
// 				handleEventsUpdate
// 			);
// 		}

// 		return () => {
// 			if (unsubscribe) unsubscribe();
// 		};
// 	}, [
// 		filterType,
// 		companyId,
// 		userId,
// 		selectedUsers,
// 		showAllSelectedOnly,
// 		showExactSelectedOnly,
// 		handleEventsUpdate,
// 		userPrivilege,
// 	]);

// 	return { agendaItems, markedDates, refreshKey, refreshAgenda };
// };
