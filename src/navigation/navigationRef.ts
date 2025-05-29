import { createRef } from "react";
import {
	NavigationContainerRef,
	ParamListBase,
} from "@react-navigation/native";

export const navigationRef = createRef<NavigationContainerRef<ParamListBase>>();

export function navigate(name: string, params?: object) {
	if (navigationRef.current) {
		navigationRef.current.navigate(name, params);
	}
}
