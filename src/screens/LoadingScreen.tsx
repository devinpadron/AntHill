import React from "react";
import { Loading } from "../components/ui/Loading";
import { Screen } from "../components/ui/Screen";

/**
 * A full-screen spinner.
 *
 * Kept as a screen-shaped wrapper because several screens return it directly
 * while their data loads. Prefer `SkeletonList` where the shape of the incoming
 * content is known — the layout does not jump when the data lands.
 */
const LoadingScreen = ({ label }: { label?: string }) => (
	<Screen>
		<Loading label={label} />
	</Screen>
);

export default LoadingScreen;
