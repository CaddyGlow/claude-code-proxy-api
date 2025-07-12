// Type definitions for Claude Code Proxy Metrics API

export type MetricType =
	| "request"
	| "response"
	| "error"
	| "cost"
	| "latency"
	| "usage";

export interface BaseMetricRecord {
	id: string;
	timestamp: string;
	metric_type: MetricType;
	request_id?: string;
	user_id?: string;
	session_id?: string;
	metadata: Record<string, any>;
}

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

export interface MetricsSummary {
	time_period: {
		start_time: string;
		end_time: string;
	};
	request_metrics: {
		total_requests: number;
		successful_requests: number;
		failed_requests: number;
		error_rate: number;
	};
	response_metrics: {
		avg_response_time_ms: number;
		p95_response_time_ms: number;
		p99_response_time_ms: number;
	};
	performance: {
		avg_response_time_ms: number;
		p95_response_time_ms: number;
		p99_response_time_ms: number;
	};
	token_metrics: {
		total_input_tokens: number;
		total_output_tokens: number;
		total_tokens: number;
	};
	cost_metrics: {
		total_cost: number;
		avg_cost_per_request: number;
	};
	usage_patterns: {
		unique_users: number;
		peak_requests_per_minute: number;
	};
	model_usage?: Record<string, number>;
	error_types?: Record<string, number>;
	// API also uses these field names
	models?: Record<string, number>;
	errors?: Record<string, number>;
}

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
		metric_type?: MetricType;
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
			metric_types?: MetricType[];
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
