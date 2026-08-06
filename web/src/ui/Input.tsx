import {
	useId,
	type InputHTMLAttributes,
	type ReactNode,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
} from "react";
import { Text } from "./Text";
import { Icon, type IconName } from "./Icon";
import styles from "./Input.module.css";

/*
 * Mirrors src/components/ui/Input.tsx: a sunken well by default, switching to
 * `surface` with an accent border on focus, and errors rendered as text
 * BENEATH the field rather than in an alert. On a form with fifteen fields
 * that difference is the whole usability story.
 */

type FieldShellProps = {
	label?: string;
	hint?: string;
	error?: string;
	required?: boolean;
	htmlFor: string;
	children: ReactNode;
};

function FieldShell({
	label,
	hint,
	error,
	required,
	htmlFor,
	children,
}: FieldShellProps) {
	return (
		<div className={styles.field}>
			{label && (
				<label htmlFor={htmlFor} className={styles.label}>
					{label}
					{required && <span className={styles.required}> *</span>}
				</label>
			)}
			{children}
			{error ? (
				<Text variant="caption" tone="danger" role="alert">
					{error}
				</Text>
			) : hint ? (
				<Text variant="caption" tone="tertiary">
					{hint}
				</Text>
			) : null}
		</div>
	);
}

/* ------------------------------------------------------------------ input */

export type InputProps = {
	label?: string;
	hint?: string;
	error?: string;
	icon?: IconName;
	/** Trailing control — a clear button, a unit, a picker trigger. */
	suffix?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

export function Input({
	label,
	hint,
	error,
	icon,
	suffix,
	id,
	className,
	required,
	...rest
}: InputProps) {
	const generated = useId();
	const fieldId = id ?? generated;

	return (
		<FieldShell
			label={label}
			hint={hint}
			error={error}
			required={required}
			htmlFor={fieldId}
		>
			<div
				className={[
					styles.well,
					error ? styles.wellError : "",
					className ?? "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				{icon && (
					<Icon
						name={icon}
						size="sm"
						className={styles.leadingIcon}
					/>
				)}
				<input
					id={fieldId}
					className={styles.input}
					aria-invalid={error ? true : undefined}
					required={required}
					{...rest}
				/>
				{suffix && <span className={styles.suffix}>{suffix}</span>}
			</div>
		</FieldShell>
	);
}

/* --------------------------------------------------------------- textarea */

export type TextareaProps = {
	label?: string;
	hint?: string;
	error?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({
	label,
	hint,
	error,
	id,
	rows = 4,
	className,
	required,
	...rest
}: TextareaProps) {
	const generated = useId();
	const fieldId = id ?? generated;

	return (
		<FieldShell
			label={label}
			hint={hint}
			error={error}
			required={required}
			htmlFor={fieldId}
		>
			<textarea
				id={fieldId}
				rows={rows}
				className={[
					styles.well,
					styles.textarea,
					error ? styles.wellError : "",
					className ?? "",
				]
					.filter(Boolean)
					.join(" ")}
				aria-invalid={error ? true : undefined}
				required={required}
				{...rest}
			/>
		</FieldShell>
	);
}

/* ----------------------------------------------------------------- select */

export type SelectProps = {
	label?: string;
	hint?: string;
	error?: string;
	children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>;

export function Select({
	label,
	hint,
	error,
	id,
	className,
	required,
	children,
	...rest
}: SelectProps) {
	const generated = useId();
	const fieldId = id ?? generated;

	return (
		<FieldShell
			label={label}
			hint={hint}
			error={error}
			required={required}
			htmlFor={fieldId}
		>
			<div
				className={[styles.well, error ? styles.wellError : ""]
					.filter(Boolean)
					.join(" ")}
			>
				<select
					id={fieldId}
					className={[styles.input, styles.select, className ?? ""]
						.filter(Boolean)
						.join(" ")}
					aria-invalid={error ? true : undefined}
					required={required}
					{...rest}
				>
					{children}
				</select>
				<Icon
					name="chevron-down"
					size="sm"
					className={styles.selectChevron}
				/>
			</div>
		</FieldShell>
	);
}
