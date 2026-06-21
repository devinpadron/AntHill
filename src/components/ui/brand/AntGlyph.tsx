import React from "react";
import Svg, { Ellipse, Path } from "react-native-svg";
import { Ink } from "../../../constants/colors";

interface AntGlyphProps {
	size?: number;
	color?: string;
}

/**
 * Abstract "ant" — three stacked ovals + antennae + legs. Calm, not literal.
 * Translated 1:1 from the design hand-off `ui.jsx` glyph.
 */
export const AntGlyph: React.FC<AntGlyphProps> = ({
	size = 18,
	color = Ink[900],
}) => {
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
			{/* antennae */}
			<Path
				d="M9.5 5.5 C 8 3.5, 6.5 3, 5 3.5"
				stroke={color}
				strokeWidth={1.4}
				strokeLinecap="round"
			/>
			<Path
				d="M14.5 5.5 C 16 3.5, 17.5 3, 19 3.5"
				stroke={color}
				strokeWidth={1.4}
				strokeLinecap="round"
			/>
			{/* head */}
			<Ellipse cx={12} cy={7} rx={3} ry={2.6} fill={color} />
			{/* thorax */}
			<Ellipse cx={12} cy={12} rx={2.4} ry={2.1} fill={color} />
			{/* abdomen */}
			<Ellipse cx={12} cy={17.5} rx={3.6} ry={3.1} fill={color} />
			{/* legs */}
			<Path
				d="M9.5 11.5 L 5.5 10  M9.5 12.5 L 5 13  M9.5 13.5 L 5.5 15.5"
				stroke={color}
				strokeWidth={1.3}
				strokeLinecap="round"
			/>
			<Path
				d="M14.5 11.5 L 18.5 10  M14.5 12.5 L 19 13  M14.5 13.5 L 18.5 15.5"
				stroke={color}
				strokeWidth={1.3}
				strokeLinecap="round"
			/>
		</Svg>
	);
};
