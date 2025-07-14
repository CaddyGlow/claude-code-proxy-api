import type {
	AnalyticsResponse,
	MetricsStreamEvent,
} from "../../src/lib/types/metrics";

export const mockAnalyticsData: AnalyticsResponse = {
	summary: {
		total_requests: 1250,
		successful_requests: 1200,
		failed_requests: 50,
		avg_response_time: 1.25,
		median_response_time: 1.1,
		p95_response_time: 2.5,
		total_tokens_input: 150000,
		total_tokens_output: 75000,
		total_cost_usd: 12.5432,
	},
	hourly_data: [
		{ hour: "2024-01-01T10:00:00Z", request_count: 100, error_count: 5 },
		{ hour: "2024-01-01T11:00:00Z", request_count: 150, error_count: 3 },
		{ hour: "2024-01-01T12:00:00Z", request_count: 200, error_count: 2 },
		{ hour: "2024-01-01T13:00:00Z", request_count: 180, error_count: 1 },
		{ hour: "2024-01-01T14:00:00Z", request_count: 220, error_count: 4 },
	],
	model_stats: [
		{
			model: "claude-3-sonnet-20240229",
			request_count: 800,
			avg_response_time: 1.2,
			total_cost: 8.5,
		},
		{
			model: "claude-3-opus-20240229",
			request_count: 450,
			avg_response_time: 1.3,
			total_cost: 4.0,
		},
		{
			model: "claude-3-haiku-20240307",
			request_count: 200,
			avg_response_time: 0.8,
			total_cost: 1.2,
		},
	],
	service_breakdown: [
		{
			service_type: "proxy_service",
			request_count: 900,
			avg_response_time: 1.1,
			median_response_time: 1.0,
			p95_response_time: 2.0,
			total_cost: 9.0,
		},
		{
			service_type: "claude_sdk_service",
			request_count: 350,
			avg_response_time: 1.5,
			median_response_time: 1.3,
			p95_response_time: 3.0,
			total_cost: 3.5,
		},
	],
	query_time: 0.045,
	query_params: {
		start_time: null,
		end_time: null,
		model: null,
		service_type: null,
		hours: 24,
	},
};

export const mockAnalyticsDataEmpty: AnalyticsResponse = {
	summary: {
		total_requests: 0,
		successful_requests: 0,
		failed_requests: 0,
		avg_response_time: 0,
		median_response_time: 0,
		p95_response_time: 0,
		total_tokens_input: 0,
		total_tokens_output: 0,
		total_cost_usd: 0,
	},
	hourly_data: [],
	model_stats: [],
	service_breakdown: [],
	query_time: 0.001,
	query_params: {
		start_time: null,
		end_time: null,
		model: null,
		service_type: null,
		hours: 24,
	},
};

export const mockAnalyticsDataReduced: AnalyticsResponse = {
	...mockAnalyticsData,
	summary: {
		...mockAnalyticsData.summary,
		total_requests: 500,
		successful_requests: 480,
		failed_requests: 20,
		total_cost_usd: 6.25,
	},
};

export const mockSSEEvents: MetricsStreamEvent[] = [
	{
		type: "connection",
		message: "Connected to live stream",
		timestamp: Date.now(),
	},
	{
		type: "analytics_update",
		data: mockAnalyticsData,
		timestamp: Date.now() + 1000,
	},
	{
		type: "heartbeat",
		stats: { total_requests: 1250, timestamp: Date.now() + 2000 },
		timestamp: Date.now() + 2000,
	},
];

export const mockSSEErrorEvents: MetricsStreamEvent[] = [
	{
		type: "connection",
		message: "Connected to live stream",
		timestamp: Date.now(),
	},
	{
		type: "error",
		message: "Test error message",
		timestamp: Date.now() + 1000,
	},
	{
		type: "disconnect",
		message: "Connection lost",
		timestamp: Date.now() + 2000,
	},
];

export const mockHealthResponse = {
	status: "healthy",
	storage_backend: "duckdb",
	enabled: true,
	request_count: 1250,
	pool_size: 10,
};

export const mockHealthResponseUnhealthy = {
	status: "unhealthy",
	storage_backend: "duckdb",
	enabled: true,
	error: "Database connection failed",
	reason: "Network timeout",
};

export const mockStatusResponse = {
	status: "healthy",
	prometheus_enabled: "true",
	observability_system: "prometheus",
};

export const mockStatusResponseUnhealthy = {
	status: "unhealthy",
	prometheus_enabled: "false",
	observability_system: "none",
};

// Test data variants for different scenarios
export const testDataVariants = {
	highTraffic: {
		...mockAnalyticsData,
		summary: {
			...mockAnalyticsData.summary,
			total_requests: 5000,
			successful_requests: 4800,
			failed_requests: 200,
			total_cost_usd: 45.789,
		},
	},

	lowTraffic: {
		...mockAnalyticsData,
		summary: {
			...mockAnalyticsData.summary,
			total_requests: 50,
			successful_requests: 48,
			failed_requests: 2,
			total_cost_usd: 2.1234,
		},
	},

	singleModel: {
		...mockAnalyticsData,
		model_stats: [
			{
				model: "claude-3-sonnet-20240229",
				request_count: 1250,
				avg_response_time: 1.25,
				total_cost: 12.5432,
			},
		],
	},

	singleService: {
		...mockAnalyticsData,
		service_breakdown: [
			{
				service_type: "proxy_service",
				request_count: 1250,
				avg_response_time: 1.25,
				median_response_time: 1.1,
				p95_response_time: 2.5,
				total_cost: 12.5432,
			},
		],
	},

	slowResponses: {
		...mockAnalyticsData,
		summary: {
			...mockAnalyticsData.summary,
			avg_response_time: 5.25,
			median_response_time: 4.8,
			p95_response_time: 12.5,
		},
	},

	highErrorRate: {
		...mockAnalyticsData,
		summary: {
			...mockAnalyticsData.summary,
			successful_requests: 500,
			failed_requests: 750,
		},
	},
};
