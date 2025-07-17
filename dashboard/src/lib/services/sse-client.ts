import type { ApiMetricType, MetricsStreamEvent } from "$lib/types/metrics";
import { DASHBOARD_CONFIG } from "$lib/utils/constants";

export interface SSEConnectionParams {
	metric_types?: ApiMetricType[];
	user_id?: string;
	session_id?: string;
	subscription_types?: string[];
}

export type SSEEventHandler = (event: MetricsStreamEvent) => void;
export type SSEErrorHandler = (error: Error) => void;
export type SSEStatusHandler = (connected: boolean) => void;

export class SSEMetricsClient {
	private eventSource: EventSource | null = null;
	private baseUrl: string;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000; // Start with 1 second
	private maxReconnectDelay = 30000; // Max 30 seconds
	private reconnectTimeout: number | null = null;
	private isConnecting = false;
	private listeners: {
		message: SSEEventHandler[];
		error: SSEErrorHandler[];
		status: SSEStatusHandler[];
	} = {
		message: [],
		error: [],
		status: [],
	};

	constructor(baseUrl: string = DASHBOARD_CONFIG.API_BASE) {
		this.baseUrl = baseUrl;
	}

	/**
	 * Connect to the SSE stream
	 */
	connect(params: SSEConnectionParams = {}): void {
		if (this.isConnecting || this.eventSource?.readyState === EventSource.OPEN) {
			return;
		}

		this.isConnecting = true;
		this.notifyStatusListeners(false);

		const queryString = this.buildQueryString(params);
		const url = `${this.baseUrl}${DASHBOARD_CONFIG.ENDPOINTS.STREAM}${queryString ? `?${queryString}` : ""}`;

		try {
			this.eventSource = new EventSource(url);
			this.setupEventListeners();
		} catch (error) {
			this.isConnecting = false;
			const errorMsg =
				error instanceof Error ? error.message : "Failed to create EventSource";
			this.notifyErrorListeners(new Error(`SSE connection failed: ${errorMsg}`));
			this.scheduleReconnect(params);
		}
	}

	/**
	 * Disconnect from the SSE stream
	 */
	disconnect(): void {
		this.clearReconnectTimeout();
		this.isConnecting = false;
		this.reconnectAttempts = 0;

		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}

		this.notifyStatusListeners(false);
	}

	/**
	 * Check if currently connected
	 */
	isConnected(): boolean {
		return this.eventSource?.readyState === EventSource.OPEN;
	}

	/**
	 * Add event listener
	 */
	addEventListener(type: "message", handler: SSEEventHandler): void;
	addEventListener(type: "error", handler: SSEErrorHandler): void;
	addEventListener(type: "status", handler: SSEStatusHandler): void;
	addEventListener(type: string, handler: any): void {
		if (type in this.listeners) {
			this.listeners[type as keyof typeof this.listeners].push(handler);
		}
	}

	/**
	 * Remove event listener
	 */
	removeEventListener(type: "message", handler: SSEEventHandler): void;
	removeEventListener(type: "error", handler: SSEErrorHandler): void;
	removeEventListener(type: "status", handler: SSEStatusHandler): void;
	removeEventListener(type: string, handler: any): void {
		if (type in this.listeners) {
			const listeners = this.listeners[type as keyof typeof this.listeners];
			const index = listeners.indexOf(handler);
			if (index > -1) {
				listeners.splice(index, 1);
			}
		}
	}

	/**
	 * Setup EventSource event listeners
	 */
	private setupEventListeners(): void {
		if (!this.eventSource) return;

		this.eventSource.onopen = () => {
			this.isConnecting = false;
			this.reconnectAttempts = 0;
			this.reconnectDelay = 1000;
			this.clearReconnectTimeout();
			this.notifyStatusListeners(true);
		};

		this.eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				this.notifyMessageListeners(data);
			} catch (_error) {
				this.notifyErrorListeners(new Error("Failed to parse SSE message"));
			}
		};

		this.eventSource.onerror = () => {
			this.isConnecting = false;
			this.notifyStatusListeners(false);

			if (this.eventSource?.readyState === EventSource.CLOSED) {
				this.notifyErrorListeners(new Error("SSE connection closed"));
				this.scheduleReconnect();
			} else {
				this.notifyErrorListeners(new Error("SSE connection error"));
			}
		};
	}

	/**
	 * Schedule reconnection attempt
	 */
	private scheduleReconnect(params?: SSEConnectionParams): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.notifyErrorListeners(new Error("Max reconnection attempts reached"));
			return;
		}

		this.clearReconnectTimeout();
		this.reconnectAttempts++;

		this.reconnectTimeout = window.setTimeout(() => {
			this.connect(params);
		}, this.reconnectDelay);

		// Exponential backoff with jitter
		this.reconnectDelay = Math.min(
			this.reconnectDelay * 2 + Math.random() * 1000,
			this.maxReconnectDelay
		);
	}

	/**
	 * Clear reconnection timeout
	 */
	private clearReconnectTimeout(): void {
		if (this.reconnectTimeout) {
			window.clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
	}

	/**
	 * Build query string from parameters
	 */
	private buildQueryString(params: SSEConnectionParams): string {
		const searchParams = new URLSearchParams();

		if (params.metric_types) {
			params.metric_types.forEach((type) => searchParams.append("metric_types", type));
		}

		if (params.user_id) {
			searchParams.append("user_id", params.user_id);
		}

		if (params.session_id) {
			searchParams.append("session_id", params.session_id);
		}

		if (params.subscription_types) {
			params.subscription_types.forEach((type) =>
				searchParams.append("subscription_types", type)
			);
		}

		return searchParams.toString();
	}

	/**
	 * Notify message listeners
	 */
	private notifyMessageListeners(event: MetricsStreamEvent): void {
		this.listeners.message.forEach((handler) => {
			try {
				handler(event);
			} catch (error) {
				console.error("Error in SSE message handler:", error);
			}
		});
	}

	/**
	 * Notify error listeners
	 */
	private notifyErrorListeners(error: Error): void {
		this.listeners.error.forEach((handler) => {
			try {
				handler(error);
			} catch (err) {
				console.error("Error in SSE error handler:", err);
			}
		});
	}

	/**
	 * Notify status listeners
	 */
	private notifyStatusListeners(connected: boolean): void {
		this.listeners.status.forEach((handler) => {
			try {
				handler(connected);
			} catch (error) {
				console.error("Error in SSE status handler:", error);
			}
		});
	}

	/**
	 * Get connection status info
	 */
	getConnectionInfo(): {
		connected: boolean;
		connecting: boolean;
		reconnectAttempts: number;
		maxReconnectAttempts: number;
	} {
		return {
			connected: this.isConnected(),
			connecting: this.isConnecting,
			reconnectAttempts: this.reconnectAttempts,
			maxReconnectAttempts: this.maxReconnectAttempts,
		};
	}
}

// Singleton instance
export const sseClient = new SSEMetricsClient();
