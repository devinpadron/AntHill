export function Placeholder({
	eyebrow,
	title,
	note,
}: {
	eyebrow: string;
	title: string;
	note: string;
}) {
	return (
		<div>
			<div className="eyebrow">{eyebrow}</div>
			<h1
				style={{
					fontFamily: "var(--font-serif)",
					fontSize: 34,
					fontWeight: 400,
					margin: "4px 0 24px",
				}}
			>
				{title}
			</h1>
			<div
				className="card"
				style={{
					padding: 40,
					textAlign: "center",
					color: "var(--text-secondary)",
				}}
			>
				{note}
			</div>
		</div>
	);
}
