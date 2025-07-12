import { format, formatDistanceToNow, subDays, subHours } from "date-fns";
import type { TimeRange } from "./constants";
import { DASHBOARD_CONFIG, ERROR_TYPE_LABELS, MODEL_LABELS } from "./constants";

/**
 * Format a number as currency
 */
export function formatCurrency(
	value: number,
	currency: string = "USD",
): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	}).format(value);
}

/**
 * Format a number with thousand separators
 */
export function formatNumber(value: number): string {
	return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
	return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format milliseconds as a human readable duration
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${Math.round(ms)}ms`;
	}

	const seconds = ms / 1000;
	if (seconds < 60) {
		return `${seconds.toFixed(1)}s`;
	}

	const minutes = seconds / 60;
	if (minutes < 60) {
		return `${minutes.toFixed(1)}m`;
	}

	const hours = minutes / 60;
	return `${hours.toFixed(1)}h`;
}

/**
 * Format a timestamp as a relative time
 */
export function formatRelativeTime(timestamp: string): string {
	return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

/**
 * Format a timestamp as a short time
 */
export function formatShortTime(timestamp: string): string {
	return format(new Date(timestamp), "HH:mm:ss");
}

/**
 * Format a timestamp as a full date time
 */
export function formatDateTime(timestamp: string): string {
	return format(new Date(timestamp), "MMM dd, yyyy HH:mm:ss");
}

/**
 * Format bytes as human readable size
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";

	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format error type for display
 */
export function formatErrorType(errorType: string): string {
	return ERROR_TYPE_LABELS[errorType] ?? errorType;
}

/**
 * Format model name for display
 */
export function formatModelName(model: string): string {
	return MODEL_LABELS[model] ?? model;
}

/**
 * Calculate time range bounds
 */
export function getTimeRangeBounds(range: TimeRange): {
	start: Date;
	end: Date;
} {
	const end = new Date();
	const config = DASHBOARD_CONFIG.TIME_RANGES[range];

	let start: Date;
	if ("hours" in config) {
		start = subHours(end, config.hours);
	} else {
		start = subDays(end, config.days);
	}

	return { start, end };
}

/**
 * Format time range label
 */
export function formatTimeRangeLabel(range: TimeRange): string {
	return DASHBOARD_CONFIG.TIME_RANGES[range].label;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength - 3) + "...";
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(
	current: number,
	previous: number,
): number {
	if (previous === 0) return current > 0 ? 100 : 0;
	return ((current - previous) / previous) * 100;
}

/**
 * Format percentage change with sign
 */
export function formatPercentageChange(change: number): string {
	const sign = change >= 0 ? "+" : "";
	return `${sign}${change.toFixed(1)}%`;
}

/**
 * Generate a hash code from a string (for consistent colors)
 */
export function hashCode(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash);
}

/**
 * Get a color from the palette based on index or string
 */
export function getChartColor(indexOrString: number | string): string {
	const colors = DASHBOARD_CONFIG.COLORS.chart;

	if (typeof indexOrString === "number") {
		return colors[indexOrString % colors.length] ?? colors[0];
	}

	const index = hashCode(indexOrString) % colors.length;
	return colors[index] ?? colors[0];
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout;

	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};

		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number,
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;

	return function executedFunction(this: any, ...args: Parameters<T>) {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}
