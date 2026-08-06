/*
 * The portal's design-system surface. Import from "../ui", not from the
 * individual modules — same convention as the app's src/components/ui/index.ts.
 *
 * If a page finds itself writing a raw <button>, a bare font-size, or a hex
 * literal, the thing it wants probably belongs in here instead.
 */

export { Icon } from "./Icon";
export type { IconName, IconProps } from "./Icon";

export { Text } from "./Text";
export type { TextProps, TextTone } from "./Text";

export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

export { Spinner, LoadingPane } from "./Spinner";

export { Card } from "./Card";
export type { CardProps } from "./Card";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeTone } from "./Badge";

export { Input, Textarea, Select } from "./Input";
export type { InputProps, TextareaProps, SelectProps } from "./Input";

export { EmptyState } from "./EmptyState";

export { DataTable, numeric } from "./DataTable";
export type { Column, DataTableProps } from "./DataTable";

export { MiniBar } from "./MiniBar";

export { ToastProvider, ToastBridge, useToast, toast } from "./Toast";
export type { ToastTone } from "./Toast";

export { AlertHost } from "./AlertHost";
