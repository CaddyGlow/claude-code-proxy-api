import type {
	MetricsDataResponse,
	MetricsHealthResponse,
	MetricsSummary,
	ApiMetricType,
	SSEConnectionsResponse,
} from "$lib/types/metrics";
import { DASHBOARD_CONFIG } from "$lib/utils/constants";

export interface MetricsDataParams {
	start_time?: string;
	end_time?: string;
	metric_type?: ApiMetricType;
	user_id?: string;
	session_id?: string;
	limit?: number;
	offset?: number;
}

export interface MetricsSummaryParams {
	start_time?: string;
	end_time?: string;
	user_id?: string;
	session_id?: string;
}

export class MetricsApiError extends Error {
	constructor(
		message: string,
		public status?: number,
		public response?: Response,
	) {
		super(message);
		this.name = "MetricsApiError";
	}
}

export class MetricsApiClient {
	private baseUrl: string;
	private abortController: AbortController | null = null;

	constructor(baseUrl: string = DASHBOARD_CONFIG.API_BASE) {
		this.baseUrl = baseUrl;
	}

	private async request<T>(
		endpoint: string,
		options: RequestInit = {},
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;

		try {
			const response = await fetch(url, {
				headers: {
					"Content-Type": "application/json",
					...options.headers,
				},
				...options,
			});

			if (!response.ok) {
				let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

				try {
					const errorData = await response.json();
					if (errorData.detail) {
						errorMessage = errorData.detail;
					}
				} catch {
					// Ignore JSON parsing errors for error responses
				}

				throw new MetricsApiError(errorMessage, response.status, response);
			}

			const data = await response.json();
			return data as T;
		} catch (error) {
			if (error instanceof MetricsApiError) {
				throw error;
			}

			if (error instanceof Error) {
				throw new MetricsApiError(`Network error: ${error.message}`);
			}

			throw new MetricsApiError("Unknown error occurred");
		}
	}

	private buildQueryString(params: Record<string, any>): string {
		const searchParams = new URLSearchParams();

		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				if (Array.isArray(value)) {
					value.forEach((item) => searchParams.append(key, String(item)));
				} else {
					searchParams.append(key, String(value));
				}
			}
		});

		return searchParams.toString();
	}

	/**
	 * Get metrics status
	 */
	async getStatus(): Promise<{ status: string }> {
		return this.request(DASHBOARD_CONFIG.ENDPOINTS.STATUS);
	}

	/**
	 * Get metrics data with filtering and pagination
	 */
	async getMetricsData(
		params: MetricsDataParams = {},
	): Promise<MetricsDataResponse> {
		const queryString = this.buildQueryString(params);
		const endpoint = `${DASHBOARD_CONFIG.ENDPOINTS.DATA}${queryString ? `?${queryString}` : ""}`;

		return this.request<MetricsDataResponse>(endpoint);
	}

	/**
	 * Get aggregated metrics summary
	 */
	async getMetricsSummary(
		params: MetricsSummaryParams = {},
	): Promise<MetricsSummary> {
		const queryString = this.buildQueryString(params);
		const endpoint = `${DASHBOARD_CONFIG.ENDPOINTS.SUMMARY}${queryString ? `?${queryString}` : ""}`;

		return this.request<MetricsSummary>(endpoint);
	}

	/**
	 * Get metrics system health
	 */
	async getHealth(): Promise<MetricsHealthResponse> {
		return this.request<MetricsHealthResponse>(
			DASHBOARD_CONFIG.ENDPOINTS.HEALTH,
		);
	}

	/**
	 * Get SSE connections info
	 */
	async getSSEConnections(): Promise<SSEConnectionsResponse> {
		return this.request<SSEConnectionsResponse>(
			DASHBOARD_CONFIG.ENDPOINTS.SSE_CONNECTIONS,
		);
	}

	/**
	 * Get metrics data for a specific time range
	 */
	async getMetricsForTimeRange(
		startTime: Date,
		endTime: Date,
		metricType?: MetricType,
		limit: number = DASHBOARD_CONFIG.LIMITS.PAGE_SIZE,
	): Promise<MetricsDataResponse> {
		const params: MetricsDataParams = {
			start_time: startTime.toISOString(),
			end_time: endTime.toISOString(),
			limit,
		};

		if (metricType) {
			params.metric_type = metricType;
		}

		return this.getMetricsData(params);
	}

	/**
	 * Get summary for a specific time range
	 */
	async getSummaryForTimeRange(
		startTime: Date,
		endTime: Date,
		userId?: string,
	): Promise<MetricsSummary> {
		const params: MetricsSummaryParams = {
			start_time: startTime.toISOString(),
			end_time: endTime.toISOString(),
		};

		if (userId) {
			params.user_id = userId;
		}

		return this.getMetricsSummary(params);
	}

	/**
	 * Cancel any ongoing requests
	 */
	cancelRequests(): void {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
	}

	/**
	 * Check if the API is available
	 */
	async isAvailable(): Promise<boolean> {
		try {
			await this.getStatus();
			return true;
		} catch {
			return false;
		}
	}
}

// Singleton instance
export const metricsApi = new MetricsApiClient();
