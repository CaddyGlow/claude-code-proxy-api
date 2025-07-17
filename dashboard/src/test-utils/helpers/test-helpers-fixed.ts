import { tick } from "svelte";
import { expect, vi } from "vitest";

/**
 * Wait for all pending promises to resolve
 */
export async function flushPromises(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
	await tick();
}

/**
 * Wait for a specific amount of time
 */
export function waitFor(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
	condition: () => boolean,
	timeout = 1000,
	interval = 50
): Promise<void> {
	const start = Date.now();

	while (!condition()) {
		if (Date.now() - start > timeout) {
			throw new Error(`Condition not met within ${timeout}ms`);
		}
		await waitFor(interval);
	}
}

/**
 * Create a mock function that can be used to track calls
 */
export function createMockFn<T extends (...args: any[]) => any>(implementation?: T): T {
	return vi.fn(implementation) as unknown as T;
}

/**
 * Setup fake timers with common configuration
 * Uses modern Vitest 3.x compatible approach
 */
export function setupFakeTimers(): void {
	vi.useFakeTimers();
}

/**
 * Cleanup fake timers
 */
export function cleanupFakeTimers(): void {
	vi.useRealTimers();
}

/**
 * Advance timers by specified time (alternative to vi.advanceTimersByTime)
 */
export function advanceTimers(ms: number): void {
	vi.advanceTimersByTime(ms);
}

/**
 * Mock console methods to avoid noise in tests
 */
export function mockConsole(): {
	log: ReturnType<typeof vi.fn>;
	warn: ReturnType<typeof vi.fn>;
	error: ReturnType<typeof vi.fn>;
	restore: () => void;
} {
	const originalConsole = {
		log: console.log,
		warn: console.warn,
		error: console.error,
	};

	const mocks = {
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};

	console.log = mocks.log;
	console.warn = mocks.warn;
	console.error = mocks.error;

	return {
		...mocks,
		restore: () => {
			console.log = originalConsole.log;
			console.warn = originalConsole.warn;
			console.error = originalConsole.error;
		},
	};
}

/**
 * Create a promise that resolves after specified time (for fake timers)
 */
export function createDelayedPromise<T>(value: T, delay: number): Promise<T> {
	return new Promise((resolve) => {
		setTimeout(() => resolve(value), delay);
	});
}

/**
 * Helper to test error boundaries and error states
 */
export function expectToThrow(fn: () => void, expectedError?: string | RegExp): void {
	try {
		fn();
		throw new Error("Expected function to throw");
	} catch (error) {
		if (expectedError) {
			if (typeof expectedError === "string") {
				expect(error instanceof Error ? error.message : error).toBe(expectedError);
			} else {
				expect(error instanceof Error ? error.message : error).toMatch(expectedError);
			}
		}
	}
}

/**
 * Helper to test async error boundaries
 */
export async function expectToThrowAsync(
	fn: () => Promise<void>,
	expectedError?: string | RegExp
): Promise<void> {
	try {
		await fn();
		throw new Error("Expected function to throw");
	} catch (error) {
		if (expectedError) {
			if (typeof expectedError === "string") {
				expect(error instanceof Error ? error.message : error).toBe(expectedError);
			} else {
				expect(error instanceof Error ? error.message : error).toMatch(expectedError);
			}
		}
	}
}

/**
 * Utility to create test data with sensible defaults
 */
export function createTestMetricCard(overrides: Partial<any> = {}) {
	return {
		id: "test-metric",
		label: "Test Metric",
		value: "100",
		icon: "requests",
		iconColor: "blue",
		change: "+5.2%",
		changeColor: "green",
		...overrides,
	};
}

/**
 * Utility to create test analytics data
 */
export function createTestAnalyticsData(overrides: Partial<any> = {}) {
	return {
		summary: {
			total_requests: 1000,
			success_rate: 98.5,
			avg_response_time: 250,
			total_cost: 12.5,
			error_count: 15,
			unique_models: 2,
		},
		time_series: [],
		models: [],
		service_types: [],
		errors: [],
		...overrides,
	};
}
