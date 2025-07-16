export interface AnalyticsResponse {
	summary: {
		total_requests: number;
		successful_requests: number;
		success_rate: number;
		avg_response_time: number;
		total_cost: number;
		total_cost_usd: number;
		error_count: number;
		unique_models: number;
		total_tokens_input: number;
		total_tokens_output: number;
	};
	time_series: Array<{
		timestamp: string;
		requests: number;
		success_rate: number;
		avg_response_time: number;
		cost: number;
		errors: number;
	}>;
	models: Array<{
		model: string;
		requests: number;
		success_rate: number;
		avg_response_time: number;
		cost: number;
		errors: number;
	}>;
	service_types: Array<{
		service_type: string;
		requests: number;
		success_rate: number;
		avg_response_time: number;
		cost: number;
		errors: number;
	}>;
	errors: Array<{
		error_type: string;
		count: number;
		percentage: number;
	}>;
	hourly_data: Array<{
		hour: string;
		request_count: number;
	}>;
	model_stats: Array<{
		model: string;
		request_count: number;
		avg_response_time: number;
		total_cost: number;
	}>;
	service_breakdown: Array<{
		service_type: string;
		request_count: number;
	}>;
}

export interface StorageHealthResponse {
	status: string;
	database_size: string;
	total_records: number;
	last_cleanup: string;
	retention_days: number;
}

export interface MetricsStatusResponse {
	status: string;
	uptime: number;
	version: string;
	storage_backend: string;
}

export interface QueryResponse {
	columns: string[];
	data: Array<Array<string | number>>;
	row_count: number;
	execution_time: number;
}

export interface MetricsStreamEvent {
	type:
		| "connection"
		| "analytics_update"
		| "heartbeat"
		| "error"
		| "disconnect";
	message: string;
	timestamp: string;
	data?: AnalyticsResponse;
}

export interface MetricCard {
	id: string;
	label: string;
	value: string;
	icon: string;
	iconColor: string;
	change: string;
	changeColor: string;
}

export interface DatabaseEntry {
	timestamp: string;
	request_id: string;
	model: string;
	service_type: string;
	response_time: number | null;
	status: string;
	cost_usd: number | null;
	tokens_input: number | null;
	tokens_output: number | null;
	error_message?: string;
	method?: string;
	endpoint?: string;
}

export interface EntriesResponse {
	entries: DatabaseEntry[];
	total_count: number;
	limit: number;
	offset: number;
	order_by: string;
	order_desc: boolean;
	page: number;
	total_pages: number;
}

export interface EntriesRequestParams {
	limit?: number;
	offset?: number;
	order_by?: string;
	order_desc?: boolean;
}

export type ServiceType = "anthropic" | "openai";

export type ApiMetricType =
	| "total_requests"
	| "successful_requests"
	| "failed_requests"
	| "avg_response_time"
	| "total_cost"
	| "error_count";

export interface AnalyticsRequestParams {
	hours?: number;
	service_type?: ServiceType;
	model?: string;
	start_time?: string;
	end_time?: string;
}

export interface ModelUsageData {
	model: string;
	request_count: number;
	percentage: number;
	avg_response_time: number;
	total_cost: number;
}

// Additional chart data types
export interface TimeSeriesData {
	timestamp: string;
	value: number;
}

export interface ServiceBreakdownData {
	service_type: string;
	request_count: number;
	percentage: number;
	avg_response_time: number;
	p95_response_time: number;
	total_cost: number;
}

export interface ChartDataPoint {
	label: string;
	value: number;
	timestamp?: string;
}

export interface QueryRequest {
	query: string;
	params?: Record<string, any>;
}

export interface ErrorResponse {
	error: string;
	message: string;
	status_code: number;
}

// Alias for existing type
export type AnalyticsParams = AnalyticsRequestParams;

export class MetricsApiError extends Error {
	public readonly status: number;
	public readonly response: Response;

	constructor(message: string, status: number, response: Response) {
		super(message);
		this.name = "MetricsApiError";
		this.status = status;
		this.response = response;
	}
}
