import React from "react";
import Svg, { Path } from "react-native-svg";

/**
 * Line icon set translated 1:1 from the design hand-off `ui.jsx`.
 * 24×24 viewBox, 1.6px stroke, rounded caps and joins.
 *
 * Add new icons by extending the `ICONS` map below.
 */

export type IconName =
	| "home"
	| "cal"
	| "clock"
	| "user"
	| "bell"
	| "check"
	| "plus"
	| "pause"
	| "play"
	| "pin"
	| "chev"
	| "chevL"
	| "chevD"
	| "search"
	| "filter"
	| "swap"
	| "more"
	| "wifi"
	| "signal"
	| "doc"
	| "bag"
	| "star";

const ICONS: Record<IconName, string> = {
	home: "M3 11.5 12 4l9 7.5 M5 10.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9.5",
	cal: "M4 7h16v13H4z M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2 M8 3v4 M16 3v4 M4 11h16",
	clock: "M12 7v5l3 2 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z",
	user: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z M4 21c0-4 4-6 8-6s8 2 8 6",
	bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16Z M10 20a2 2 0 0 0 4 0",
	check: "M5 12.5 10 17 19 7",
	plus: "M12 5v14 M5 12h14",
	pause: "M9 5h2v14H9z M13 5h2v14h-2z",
	play: "M7 5v14l12-7z",
	pin: "M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
	chev: "M9 6l6 6-6 6",
	chevL: "M15 6l-6 6 6 6",
	chevD: "M6 9l6 6 6-6",
	search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z M16 16l5 5",
	filter: "M4 5h16 M7 12h10 M10 19h4",
	swap: "M7 4 4 7l3 3 M4 7h13 M17 20l3-3-3-3 M20 17H7",
	more: "M5 12h.01 M12 12h.01 M19 12h.01",
	wifi: "M5 12a10 10 0 0 1 14 0 M8 15a6 6 0 0 1 8 0 M12 18h.01",
	signal: "M2 20l20-16",
	doc: "M6 3h9l4 4v14H6z M14 3v5h5",
	bag: "M5 8h14l-1 13H6L5 8Z M9 8V6a3 3 0 1 1 6 0v2",
	star: "M12 4l2.5 5 5.5.8-4 4 1 5.5L12 17l-5 2.3 1-5.5-4-4 5.5-.8L12 4Z",
};

interface IconProps {
	name: IconName;
	size?: number;
	color?: string;
	strokeWidth?: number;
	fill?: string;
}

export const Icon: React.FC<IconProps> = ({
	name,
	size = 20,
	color = "currentColor",
	strokeWidth = 1.6,
	fill = "none",
}) => {
	const d = ICONS[name];
	if (!d) return null;
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
			<Path
				d={d}
				stroke={color}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill={fill}
			/>
		</Svg>
	);
};
