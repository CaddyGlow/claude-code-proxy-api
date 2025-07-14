// TypeScript interfaces for the Claude Code Proxy Metrics API
// Based on metrics-api-typescript.md documentation

export type ServiceType = "proxy_service" | "claude_sdk_service" | "unknown";

export type ApiMetricType = "total_requests" | "successful_requests" | "failed_requests" | "avg_response_time";

// Analytics API Response Types
export interface AnalyticsResponse {
	summary: {
		total_requests: number;
		successful_requests: number;
		failed_requests: number;
		avg_response_time: number;
		median_response_time: number;
		p95_response_time: number;
		total_tokens_input: number;
		total_tokens_output: number;
		total_cost_usd: number;
	};
	hourly_data: Array<{
		hour: string; // ISO datetime string
		request_count: number;
		error_count: number;
	}>;
	model_stats: Array<{
		model: string;
		request_count: number;
		avg_response_time: number;
		total_cost: number;
	}>;
	service_breakdown: Array<{
		service_type: ServiceType;
		request_count: number;
		avg_response_time: number;
		median_response_time: number;
		p95_response_time: number;
		total_cost: number;
	}>;
	query_time: number;
	query_params: {
		start_time: number | null;
		end_time: number | null;
		model: string | null;
		service_type: string | null;
		hours: number | null;
	};
}

// SSE Stream Event Types
export type MetricsStreamEvent =
	| ConnectionEvent
	| AnalyticsUpdateEvent
	| HeartbeatEvent
	| ErrorEvent
	| DisconnectEvent;

export interface BaseEvent {
	timestamp: number;
}

export interface ConnectionEvent extends BaseEvent {
	type: "connection";
	message: string;
}

export interface AnalyticsUpdateEvent extends BaseEvent {
	type: "analytics_update";
	data: AnalyticsResponse;
}

export interface HeartbeatEvent extends BaseEvent {
	type: "heartbeat";
	stats: {
		total_requests: number;
		timestamp: number;
	};
}

export interface ErrorEvent extends BaseEvent {
	type: "error";
	message: string;
}

export interface DisconnectEvent extends BaseEvent {
	type: "disconnect";
	message: string;
}

// Storage Health Response
export interface StorageHealthResponse {
	status:
		| "healthy"
		| "unhealthy"
		| "unavailable"
		| "not_initialized"
		| "connection_failed";
	storage_backend: string;
	enabled: boolean;
	database_path?: string;
	request_count?: number;
	pool_size?: number;
	error?: string;
	reason?: string;
}

// Metrics Status Response
export interface MetricsStatusResponse {
	status: "healthy";
	prometheus_enabled: string; // "true" | "false"
	observability_system: string;
}

// Query Request/Response Types
export interface QueryRequest {
	sql: string;
	params?: Array<string | number>;
	limit?: number; // Default: 1000
}

export interface QueryResponse {
	results: Array<Record<string, any>>;
	query_time: number;
	row_count: number;
}

// Error Response Type
export interface ErrorResponse {
	detail: string;
}

// Dashboard-specific types for UI components
export interface MetricCard {
	id: string;
	label: string;
	value: string;
	icon: string;
	iconColor: string;
	change?: string;
	changeColor?: string;
}

// Chart data types for LayerChart integration
export interface ChartDataPoint {
	x: string | number | Date;
	y: number;
	label?: string;
	color?: string;
}

export interface ServiceBreakdownData {
	service_type: ServiceType;
	request_count: number;
	avg_response_time: number;
	median_response_time: number;
	p95_response_time: number;
	total_cost: number;
	percentage: number;
}

export interface ModelUsageData {
	model: string;
	request_count: number;
	avg_response_time: number;
	total_cost: number;
	percentage: number;
	color?: string;
}

export interface TimeSeriesData {
	timestamp: string;
	value: number;
	label?: string;
}

// Analytics query parameters for API calls
export interface AnalyticsParams {
	start_time?: number; // Unix timestamp
	end_time?: number; // Unix timestamp
	model?: string;
	service_type?: ServiceType;
	hours?: number; // Default: 24, min: 1, max: 168
}
