import { vi } from 'vitest';
import type { MetricsStreamEvent } from '$lib/types/metrics';

export interface MockEventSource {
	url: string;
	readyState: number;
	onopen: ((event: Event) => void) | null;
	onmessage: ((event: MessageEvent) => void) | null;
	onerror: ((event: Event) => void) | null;
	close: () => void;
	addEventListener: (type: string, listener: EventListener) => void;
	removeEventListener: (type: string, listener: EventListener) => void;
	dispatchEvent: (event: Event) => boolean;
	withCredentials: boolean;
}

export class SSEMock implements MockEventSource {
	url: string;
	readyState = 0;
	onopen: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	withCredentials = false;

	private listeners: Map<string, EventListener[]> = new Map();
	private closeCallback?: () => void;

	constructor(url: string) {
		this.url = url;

		// Simulate connection opening
		setTimeout(() => {
			this.readyState = 1; // OPEN
			const openEvent = new Event('open');
			this.onopen?.(openEvent);
			this.dispatchEvent(openEvent);
		}, 10);
	}

	close(): void {
		this.readyState = 2; // CLOSED
		this.closeCallback?.();
	}

	addEventListener(type: string, listener: EventListener): void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, []);
		}
		this.listeners.get(type)?.push(listener);
	}

	removeEventListener(type: string, listener: EventListener): void {
		const listeners = this.listeners.get(type);
		if (listeners) {
			const index = listeners.indexOf(listener);
			if (index > -1) {
				listeners.splice(index, 1);
			}
		}
	}

	dispatchEvent(event: Event): boolean {
		const listeners = this.listeners.get(event.type) || [];
		listeners.forEach(listener => listener(event));
		return true;
	}

	// Helper methods for testing
	emitMessage(data: MetricsStreamEvent): void {
		const messageEvent = new MessageEvent('message', {
			data: JSON.stringify(data)
		});
		this.onmessage?.(messageEvent);
		this.dispatchEvent(messageEvent);
	}

	emitError(): void {
		const errorEvent = new Event('error');
		this.onerror?.(errorEvent);
		this.dispatchEvent(errorEvent);
	}

	emitClose(): void {
		this.readyState = 2; // CLOSED
		this.emitError(); // SSE typically emits error on close
	}

	onClose(callback: () => void): void {
		this.closeCallback = callback;
	}
}

export function createSSEMock(url: string, events: MetricsStreamEvent[] = []): SSEMock {
	const mock = new SSEMock(url);

	// Auto-emit events after connection opens
	if (events.length > 0) {
		setTimeout(() => {
			events.forEach((event, index) => {
				setTimeout(() => mock.emitMessage(event), index * 100);
			});
		}, 20);
	}

	return mock;
}

export function mockEventSource(implementation?: typeof SSEMock): void {
	const MockedEventSource = implementation || SSEMock;
	(globalThis as any).EventSource = vi.fn().mockImplementation((url: string) => new MockedEventSource(url));
}

export function createMockSSEEvents(): MetricsStreamEvent[] {
	return [
		{
			type: 'analytics_update',
			timestamp: '2024-01-15T10:30:00Z',
			message: 'Analytics data updated',
			data: {
				summary: {
					total_requests: 1251,
					successful_requests: 1233,
					success_rate: 98.5,
					avg_response_time: 243,
					total_cost: 15.80,
					total_cost_usd: 15.80,
					error_count: 18,
					unique_models: 2,
					total_tokens_input: 50000,
					total_tokens_output: 25000
				},
				time_series: [],
				models: [],
				service_types: [],
				errors: [],
				hourly_data: [],
				model_stats: [],
				service_breakdown: []
			}
		},
		{
			type: 'connection',
			timestamp: '2024-01-15T10:30:15Z',
			message: 'Client connected successfully'
		},
		{
			type: 'error',
			timestamp: '2024-01-15T10:30:30Z',
			message: 'Rate limit exceeded'
		}
	];
}
