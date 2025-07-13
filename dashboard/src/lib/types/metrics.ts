// TypeScript interfaces for the new Claude Code Proxy Metrics API
// Based on metrics-api-typescript.md documentation

export type ServiceType = "proxy_service" | "claude_sdk_service" | "unknown";

// New Analytics API Response Types
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

// Legacy types for backward compatibility (will be phased out)
export type ApiMetricType =
	| "request"
	| "response"
	| "error"
	| "cost"
	| "latency"
	| "usage";

export interface BaseMetricRecord {
	id: string;
	timestamp: string;
	metric_type: ApiMetricType;
	request_id?: string;
	user_id?: string;
	session_id?: string;
	metadata: Record<string, any>;
}

// Legacy metric types (kept for backward compatibility during transition)
export interface RequestMetric extends BaseMetricRecord {
	metric_type: "request";
	method: string;
	path: string;
	endpoint: string;
	api_version: string;
	client_ip?: string;
	user_agent?: string;
	content_length?: number;
	content_type?: string;
	model?: string;
	provider?: string;
	max_tokens?: number;
	temperature?: number;
	streaming: boolean;
}

export interface ResponseMetric extends BaseMetricRecord {
	metric_type: "response";
	status_code: number;
	response_time_ms: number;
	content_length?: number;
	content_type?: string;
	input_tokens?: number;
	output_tokens?: number;
	cache_read_tokens?: number;
	cache_write_tokens?: number;
	streaming: boolean;
	first_token_time_ms?: number;
	stream_completion_time_ms?: number;
	completion_reason?: string;
	safety_filtered: boolean;
}

export interface ErrorMetric extends BaseMetricRecord {
	metric_type: "error";
	error_type: string;
	error_code?: string;
	error_message?: string;
	stack_trace?: string;
	endpoint?: string;
	method?: string;
	status_code?: number;
	retry_count: number;
	recoverable: boolean;
}

export interface CostMetric extends BaseMetricRecord {
	metric_type: "cost";
	input_cost: number;
	output_cost: number;
	cache_read_cost: number;
	cache_write_cost: number;
	total_cost: number;
	sdk_total_cost?: number;
	sdk_input_cost?: number;
	sdk_output_cost?: number;
	sdk_cache_read_cost?: number;
	sdk_cache_write_cost?: number;
	cost_difference?: number;
	cost_accuracy_percentage?: number;
	model: string;
	pricing_tier?: string;
	currency: string;
	input_tokens: number;
	output_tokens: number;
	cache_read_tokens: number;
	cache_write_tokens: number;
}

export interface LatencyMetric extends BaseMetricRecord {
	metric_type: "latency";
	request_processing_ms: number;
	claude_api_call_ms: number;
	response_processing_ms: number;
	total_latency_ms: number;
	queue_time_ms: number;
	wait_time_ms: number;
	first_token_latency_ms?: number;
	token_generation_rate?: number;
}

export interface UsageMetric extends BaseMetricRecord {
	metric_type: "usage";
	request_count: number;
	token_count: number;
	window_start: string;
	window_end: string;
	window_duration_seconds: number;
	aggregation_level: string;
}

export type AnyMetric =
	| RequestMetric
	| ResponseMetric
	| ErrorMetric
	| CostMetric
	| LatencyMetric
	| UsageMetric;

// Legacy response types (for backward compatibility)
export interface MetricsDataResponse {
	data: AnyMetric[];
	pagination: {
		total_count: number;
		returned_count: number;
		offset: number;
		limit: number;
		has_next: boolean;
		has_previous: boolean;
		next_offset?: number;
		previous_offset?: number;
	};
	filters: {
		start_time?: string;
		end_time?: string;
		metric_type?: ApiMetricType;
		user_id?: string;
		session_id?: string;
	};
}

export interface MetricsHealthResponse {
	healthy: boolean;
	storage: {
		healthy: boolean;
		total_metrics: number;
		last_update: string;
	};
	collector: {
		healthy: boolean;
		metrics_collected: number;
		buffer_size: number;
		last_flush: string;
	};
	sse: {
		healthy: boolean;
		connections: number;
		max_connections: number;
	};
}

export interface SSEConnectionsResponse {
	total_connections: number;
	max_connections: number;
	connections: Array<{
		id: string;
		created_at: string;
		filters: {
			metric_types?: ApiMetricType[];
			user_id?: string;
			session_id?: string;
		};
		subscription_types: string[];
	}>;
}

export interface SSEEvent {
	event: "metric" | "summary" | "heartbeat" | "error";
	data: any;
	timestamp?: string;
}

// Legacy summary interface (for backward compatibility)
export interface MetricsSummary {
	time_period: {
		start_time: string;
		end_time: string;
		duration_hours: number;
	};
	requests: {
		total: number;
		successful: number;
		failed: number;
		error_rate: number;
		success_rate: number;
	};
	performance: {
		avg_response_time_ms: number;
		p95_response_time_ms: number;
		p99_response_time_ms: number;
	};
	tokens: {
		total_input: number;
		total_output: number;
		total: number;
		avg_input_per_request: number;
		avg_output_per_request: number;
	};
	costs: {
		total: number;
		avg_per_request: number;
		currency: string;
	};
	usage: {
		unique_users: number;
		peak_requests_per_minute: number;
		requests_per_hour: number;
	};
	models: Record<string, number>;
	errors: Record<string, number>;
}
