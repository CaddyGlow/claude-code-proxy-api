// Type definitions for Dashboard Components
export type MetricType =
	| "request"
	| "response"
	| "error"
	| "cost"
	| "latency"
	| "usage";

export type TimeRange = "1h" | "6h" | "24h" | "7d";

export type ActivityStatus = "success" | "error" | "warning" | "info";

export interface MetricCard {
	id: string;
	label: string;
	value: string;
	icon: string;
	iconColor: string;
	change?: string;
	changeColor?: string;
}

export interface ActivityItem {
	id: string;
	timestamp: string;
	type: MetricType;
	title: string;
	subtitle: string;
	status: ActivityStatus;
}

export interface LoadingState {
	isLoading: boolean;
	message?: string;
}

export interface ErrorState {
	hasError: boolean;
	message?: string;
	details?: string;
}

export interface TimeRangeOption {
	value: TimeRange;
	label: string;
}

// Event callback types
export type TimeRangeChangeCallback = (timeRange: TimeRange) => void;
export type AutoRefreshChangeCallback = (enabled: boolean) => void;
export type ErrorRetryCallback = () => void;
