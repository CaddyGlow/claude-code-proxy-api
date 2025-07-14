import type {
	AnalyticsResponse,
	AnalyticsParams,
	StorageHealthResponse,
	MetricsStatusResponse,
	QueryRequest,
	QueryResponse,
} from "$lib/types/metrics";
import { DASHBOARD_CONFIG } from "$lib/utils/constants";

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
	 * Get analytics data
	 */
	async getAnalytics(params: AnalyticsParams = {}): Promise<AnalyticsResponse> {
		const queryString = this.buildQueryString(params);
		const endpoint = `/analytics${queryString ? `?${queryString}` : ""}`;
		return this.request<AnalyticsResponse>(endpoint);
	}

	/**
	 * Get storage health status
	 */
	async getHealth(): Promise<StorageHealthResponse> {
		return this.request<StorageHealthResponse>("/health");
	}

	/**
	 * Get metrics system status
	 */
	async getStatus(): Promise<MetricsStatusResponse> {
		return this.request<MetricsStatusResponse>("/status");
	}

	/**
	 * Execute custom SQL query
	 */
	async executeQuery(request: QueryRequest): Promise<QueryResponse> {
		return this.request<QueryResponse>("/query", {
			method: "POST",
			body: JSON.stringify(request),
		});
	}

	/**
	 * Create SSE connection for real-time metrics
	 */
	createSSEConnection(baseUrl?: string): EventSource {
		const url = `${baseUrl || this.baseUrl}/stream`;
		return new EventSource(url);
	}

	/**
	 * Get analytics for a specific time range
	 */
	async getAnalyticsForTimeRange(
		startTime: Date,
		endTime: Date,
		serviceType?: string,
		model?: string,
	): Promise<AnalyticsResponse> {
		const params: AnalyticsParams = {
			start_time: Math.floor(startTime.getTime() / 1000),
			end_time: Math.floor(endTime.getTime() / 1000),
		};

		if (serviceType) {
			params.service_type = serviceType as any;
		}

		if (model) {
			params.model = model;
		}

		return this.getAnalytics(params);
	}

	/**
	 * Get analytics for the last N hours
	 */
	async getAnalyticsForHours(
		hours: number = 24,
		serviceType?: string,
		model?: string,
	): Promise<AnalyticsResponse> {
		const params: AnalyticsParams = {
			hours: Math.min(Math.max(hours, 1), 168), // Clamp between 1 and 168 hours
		};

		if (serviceType) {
			params.service_type = serviceType as any;
		}

		if (model) {
			params.model = model;
		}

		return this.getAnalytics(params);
	}

	/**
	 * Get analytics filtered by service type
	 */
	async getAnalyticsByService(
		serviceType: string,
		hours: number = 24,
	): Promise<AnalyticsResponse> {
		return this.getAnalyticsForHours(hours, serviceType);
	}

	/**
	 * Get analytics filtered by model
	 */
	async getAnalyticsByModel(
		model: string,
		hours: number = 24,
	): Promise<AnalyticsResponse> {
		return this.getAnalyticsForHours(hours, undefined, model);
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
			const status = await this.getStatus();
			return status.status === "healthy";
		} catch {
			return false;
		}
	}

	/**
	 * Check if the storage backend is healthy
	 */
	async isStorageHealthy(): Promise<boolean> {
		try {
			const health = await this.getHealth();
			return health.status === "healthy";
		} catch {
			return false;
		}
	}
}

// Singleton instance
export const metricsApi = new MetricsApiClient();
