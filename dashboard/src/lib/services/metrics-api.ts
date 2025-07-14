import type {
	AnalyticsResponse,
	StorageHealthResponse,
	MetricsStatusResponse,
	QueryResponse,
	AnalyticsRequestParams,
} from "$lib/types/metrics";
import { MetricsApiError } from "$lib/types/metrics";

/**
 * Centralized API client for Analytics API integration
 */
export class MetricsApiClient {
	private readonly baseUrl: string;
	private readonly timeout: number;

	constructor(baseUrl = "/metrics", timeout = 10000) {
		this.baseUrl = baseUrl;
		this.timeout = timeout;
	}

	/**
	 * Build query string from parameters
	 */
	public buildQueryString(params: Record<string, any>): string {
		const searchParams = new URLSearchParams();

		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				searchParams.append(key, value.toString());
			}
		});

		const queryString = searchParams.toString();
		return queryString ? `?${queryString}` : "";
	}

	/**
	 * Make HTTP request with timeout and error handling
	 */
	private async makeRequest(
		url: string,
		options: RequestInit = {},
	): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal,
				headers: {
					"Content-Type": "application/json",
					...options.headers,
				},
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new MetricsApiError(
					`HTTP ${response.status}: ${response.statusText}`,
					response.status,
					response,
				);
			}

			return response;
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof MetricsApiError) {
				throw error;
			}

			if (error instanceof DOMException && error.name === "AbortError") {
				throw new MetricsApiError("Request timeout", 408, new Response());
			}

			throw new MetricsApiError(
				`Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
				0,
				new Response(),
			);
		}
	}

	/**
	 * Get analytics data
	 */
	public async getAnalytics(
		params: AnalyticsRequestParams = {},
	): Promise<AnalyticsResponse> {
		const queryString = this.buildQueryString(params);
		const url = `${this.baseUrl}/analytics${queryString}`;

		const response = await this.makeRequest(url);
		return await response.json();
	}

	/**
	 * Get storage health information
	 */
	public async getHealth(): Promise<StorageHealthResponse> {
		const url = `${this.baseUrl}/health`;
		const response = await this.makeRequest(url);
		return await response.json();
	}

	/**
	 * Get metrics status
	 */
	public async getStatus(): Promise<MetricsStatusResponse> {
		const url = `${this.baseUrl}/status`;
		const response = await this.makeRequest(url);
		return await response.json();
	}

	/**
	 * Execute custom query
	 */
	public async executeQuery(query: string): Promise<QueryResponse> {
		const url = `${this.baseUrl}/query`;

		const response = await this.makeRequest(url, {
			method: "POST",
			body: JSON.stringify({ query }),
		});

		return await response.json();
	}

	/**
	 * Check if the API is available
	 */
	public async isAvailable(): Promise<boolean> {
		try {
			await this.getStatus();
			return true;
		} catch (_error) {
			return false;
		}
	}

	/**
	 * Check if storage is healthy
	 */
	public async isStorageHealthy(): Promise<boolean> {
		try {
			const health = await this.getHealth();
			return health.status === "healthy";
		} catch (_error) {
			return false;
		}
	}

	/**
	 * Create Server-Sent Events connection for real-time updates
	 */
	public createSSEConnection(): EventSource {
		const url = `${this.baseUrl}/stream`;
		return new EventSource(url);
	}
}

// Export singleton instance
export const metricsApi = new MetricsApiClient();
