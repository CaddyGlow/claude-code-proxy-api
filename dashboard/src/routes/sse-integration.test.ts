import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { metricsApi } from "$lib/services/metrics-api";
import type { AnalyticsResponse, MetricsStreamEvent } from "$lib/types/metrics";
import {
	cleanupFakeTimers,
	flushPromises,
	setupFakeTimers,
} from "../test-utils/helpers/test-helpers";
import { createSSEMock, mockEventSource } from "../test-utils/mocks/sse";
import DashboardPage from "./+page.svelte";

describe("SSE Integration Tests", () => {
	let mockSSEConnection: ReturnType<typeof createSSEMock>;
	let mockAnalyticsData: AnalyticsResponse;

	beforeEach(() => {
		// Setup fake timers
		setupFakeTimers();

		// Mock EventSource globally
		mockEventSource();

		// Mock the metricsApi methods directly
		vi.spyOn(metricsApi, "getAnalytics");
		vi.spyOn(metricsApi, "createSSEConnection");
		vi.spyOn(metricsApi, "getHealth");
		vi.spyOn(metricsApi, "getStatus");
		vi.spyOn(metricsApi, "executeQuery");

		// Create mock analytics data
		mockAnalyticsData = {
			summary: {
				total_requests: 1000,
				successful_requests: 950,
				success_rate: 95.0,
				avg_response_time: 245.5,
				total_cost: 12.5,
				total_cost_usd: 12.5,
				error_count: 50,
				unique_models: 3,
				total_tokens_input: 50000,
				total_tokens_output: 25000,
			},
			time_series: [
				{
					timestamp: "2024-01-15T10:00:00Z",
					requests: 100,
					success_rate: 95.0,
					avg_response_time: 250,
					cost: 2.5,
					errors: 5,
				},
				{
					timestamp: "2024-01-15T11:00:00Z",
					requests: 150,
					success_rate: 96.0,
					avg_response_time: 240,
					cost: 3.75,
					errors: 4,
				},
			],
			models: [
				{
					model: "claude-3-sonnet",
					requests: 600,
					success_rate: 96.0,
					avg_response_time: 240,
					cost: 7.5,
					errors: 24,
				},
				{
					model: "claude-3-haiku",
					requests: 400,
					success_rate: 94.0,
					avg_response_time: 250,
					cost: 5.0,
					errors: 26,
				},
			],
			service_types: [
				{
					service_type: "anthropic",
					requests: 800,
					success_rate: 95.5,
					avg_response_time: 245,
					cost: 10.0,
					errors: 36,
				},
				{
					service_type: "openai",
					requests: 200,
					success_rate: 93.0,
					avg_response_time: 250,
					cost: 2.5,
					errors: 14,
				},
			],
			errors: [
				{
					error_type: "rate_limit_exceeded",
					count: 30,
					percentage: 60.0,
				},
				{
					error_type: "timeout",
					count: 20,
					percentage: 40.0,
				},
			],
			hourly_data: [
				{
					hour: "2024-01-15T10:00:00Z",
					request_count: 100,
				},
				{
					hour: "2024-01-15T11:00:00Z",
					request_count: 150,
				},
			],
			model_stats: [
				{
					model: "claude-3-sonnet",
					request_count: 600,
					avg_response_time: 240,
					total_cost: 7.5,
				},
				{
					model: "claude-3-haiku",
					request_count: 400,
					avg_response_time: 250,
					total_cost: 5.0,
				},
			],
			service_breakdown: [
				{
					service_type: "anthropic",
					request_count: 800,
				},
				{
					service_type: "openai",
					request_count: 200,
				},
			],
		};

		// Mock the metrics API
		(metricsApi.getAnalytics as any).mockResolvedValue(mockAnalyticsData);

		// Setup mock SSE connection
		mockSSEConnection = createSSEMock("http://localhost:8000/metrics/stream");
		(metricsApi.createSSEConnection as any).mockReturnValue(mockSSEConnection as any);
	});

	afterEach(() => {
		cleanupFakeTimers();
		vi.clearAllMocks();
	});

	describe("Dashboard SSE Integration", () => {
		it("should render dashboard with initial data and establish SSE connection", async () => {
			// Act
			render(DashboardPage);
			await flushPromises();

			// Assert initial API calls
			expect(metricsApi.getAnalytics).toHaveBeenCalledWith({
				hours: 24,
			});
			expect(metricsApi.createSSEConnection).toHaveBeenCalled();

			// Assert initial data rendering
			expect(screen.getByText("1000")).toBeInTheDocument(); // Total requests
			expect(screen.getByText("95.0%")).toBeInTheDocument(); // Success rate
			expect(screen.getByText("246s")).toBeInTheDocument(); // Avg response time
			expect(screen.getByText("$12.5000")).toBeInTheDocument(); // Total cost
		});

		it("should update dashboard when receiving analytics_update SSE event", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Create updated analytics data
			const updatedData: AnalyticsResponse = {
				...mockAnalyticsData,
				summary: {
					...mockAnalyticsData.summary,
					total_requests: 1500,
					successful_requests: 1425,
					success_rate: 95.0,
					avg_response_time: 230.0,
					total_cost_usd: 18.75,
				},
			};

			// Create SSE event
			const sseEvent: MetricsStreamEvent = {
				type: "analytics_update",
				message: "Analytics data updated",
				timestamp: "2024-01-15T12:00:00Z",
				data: updatedData,
			};

			// Act - Simulate receiving SSE event
			mockSSEConnection.emitMessage(sseEvent);
			await flushPromises();
			await tick();

			// Assert data updates
			expect(screen.getByText("1500")).toBeInTheDocument(); // Updated total requests
			expect(screen.getByText("95.0%")).toBeInTheDocument(); // Updated success rate
			expect(screen.getByText("230s")).toBeInTheDocument(); // Updated avg response time
			expect(screen.getByText("$18.7500")).toBeInTheDocument(); // Updated total cost
		});

		it("should show connection notification when SSE connection opens", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Act - Simulate SSE connection opening
			const openEvent = new Event("open");
			mockSSEConnection.onopen?.(openEvent);
			await flushPromises();
			await tick();

			// Assert notification appears
			expect(screen.getByText("Connected to live stream")).toBeInTheDocument();
		});

		it("should handle SSE connection events and show notifications", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Test connection event
			const connectionEvent: MetricsStreamEvent = {
				type: "connection",
				message: "Client connected successfully",
				timestamp: "2024-01-15T12:00:00Z",
			};

			// Act
			mockSSEConnection.emitMessage(connectionEvent);
			await flushPromises();
			await tick();

			// Assert
			expect(
				screen.getByText("Connected: Client connected successfully")
			).toBeInTheDocument();
		});

		it("should handle SSE error events and show error notifications", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Test error event
			const errorEvent: MetricsStreamEvent = {
				type: "error",
				message: "Database connection failed",
				timestamp: "2024-01-15T12:00:00Z",
			};

			// Act
			mockSSEConnection.emitMessage(errorEvent);
			await flushPromises();
			await tick();

			// Assert
			expect(screen.getByText("Error: Database connection failed")).toBeInTheDocument();
		});

		it("should handle SSE disconnect events and show notifications", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Test disconnect event
			const disconnectEvent: MetricsStreamEvent = {
				type: "disconnect",
				message: "Server shutting down",
				timestamp: "2024-01-15T12:00:00Z",
			};

			// Act
			mockSSEConnection.emitMessage(disconnectEvent);
			await flushPromises();
			await tick();

			// Assert
			expect(
				screen.getByText("Disconnected: Server shutting down")
			).toBeInTheDocument();
		});

		it("should handle heartbeat events without showing notifications", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Clear any existing notifications
			const initialNotifications = screen.queryAllByText(/Connected to live stream/);
			const initialCount = initialNotifications.length;

			// Test heartbeat event
			const heartbeatEvent: MetricsStreamEvent = {
				type: "heartbeat",
				message: "Server heartbeat",
				timestamp: "2024-01-15T12:00:00Z",
			};

			// Act
			mockSSEConnection.emitMessage(heartbeatEvent);
			await flushPromises();
			await tick();

			// Assert no new notifications were added
			const finalNotifications = screen.queryAllByText(/Connected to live stream/);
			expect(finalNotifications.length).toBe(initialCount);
		});

		it("should handle malformed SSE messages gracefully", async () => {
			// Arrange
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			render(DashboardPage);
			await flushPromises();

			// Act - Simulate malformed JSON
			const malformedEvent = new MessageEvent("message", {
				data: "invalid json {",
			});
			mockSSEConnection.onmessage?.(malformedEvent);
			await flushPromises();
			await tick();

			// Assert error was logged (in development mode)
			expect(consoleSpy).toHaveBeenCalledWith(
				"Failed to parse stream event:",
				expect.any(Error)
			);

			// Cleanup
			consoleSpy.mockRestore();
		});
	});

	describe("Connection Loss and Recovery", () => {
		it("should handle SSE connection errors and show error notifications", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Act - Simulate connection error
			const errorEvent = new Event("error");
			mockSSEConnection.onerror?.(errorEvent);
			await flushPromises();
			await tick();

			// Assert
			expect(screen.getByText("Connection error")).toBeInTheDocument();
		});

		it("should close SSE connection on component unmount", async () => {
			// Arrange
			const closeSpy = vi.spyOn(mockSSEConnection, "close");
			const { unmount } = render(DashboardPage);
			await flushPromises();

			// Act
			unmount();

			// Assert
			expect(closeSpy).toHaveBeenCalled();
		});

		it("should handle SSE setup errors gracefully", async () => {
			// Arrange
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			(metricsApi.createSSEConnection as any).mockImplementation(() => {
				throw new Error("Failed to create SSE connection");
			});

			// Act
			render(DashboardPage);
			await flushPromises();

			// Assert error was logged
			expect(consoleSpy).toHaveBeenCalledWith(
				"Failed to setup SSE:",
				expect.any(Error)
			);

			// Cleanup
			consoleSpy.mockRestore();
		});
	});

	describe("Real-time Data Updates", () => {
		it("should update metric cards with detailed analytics information", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Create comprehensive update with all fields
			const comprehensiveUpdate: AnalyticsResponse = {
				...mockAnalyticsData,
				summary: {
					...mockAnalyticsData.summary,
					total_requests: 2000,
					successful_requests: 1900,
					success_rate: 95.0,
					avg_response_time: 220.0,
					total_cost_usd: 25.0,
					total_tokens_input: 100000,
					total_tokens_output: 50000,
				},
				model_stats: [
					{
						model: "claude-3-sonnet",
						request_count: 1200,
						avg_response_time: 210,
						total_cost: 15.0,
					},
					{
						model: "claude-3-haiku",
						request_count: 800,
						avg_response_time: 230,
						total_cost: 10.0,
					},
				],
				service_breakdown: [
					{
						service_type: "anthropic",
						request_count: 1500,
					},
					{
						service_type: "openai",
						request_count: 500,
					},
				],
			};

			const updateEvent: MetricsStreamEvent = {
				type: "analytics_update",
				message: "Analytics updated",
				timestamp: "2024-01-15T13:00:00Z",
				data: comprehensiveUpdate,
			};

			// Act
			mockSSEConnection.emitMessage(updateEvent);
			await flushPromises();
			await tick();

			// Assert metric cards updated
			expect(screen.getByText("2000")).toBeInTheDocument(); // Total requests
			expect(screen.getByText("95.0%")).toBeInTheDocument(); // Success rate
			expect(screen.getByText("220s")).toBeInTheDocument(); // Avg response time
			expect(screen.getByText("$25.0000")).toBeInTheDocument(); // Total cost

			// Assert detailed notification contains analytics info
			expect(screen.getByText(/2000 requests/)).toBeInTheDocument();
			expect(screen.getByText(/150000 tokens/)).toBeInTheDocument();
			expect(screen.getByText(/\$25.0000/)).toBeInTheDocument();
			expect(screen.getByText(/Top: claude-3-sonnet/)).toBeInTheDocument();
			expect(screen.getByText(/Services: anthropic, openai/)).toBeInTheDocument();
		});

		it("should handle analytics updates with missing data gracefully", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Create update with minimal data
			const minimalUpdate: AnalyticsResponse = {
				summary: {
					total_requests: 500,
					successful_requests: 475,
					success_rate: 95.0,
					avg_response_time: 200.0,
					total_cost: 0,
					total_cost_usd: 0,
					error_count: 25,
					unique_models: 1,
					total_tokens_input: 0,
					total_tokens_output: 0,
				},
				time_series: [],
				models: [],
				service_types: [],
				errors: [],
				hourly_data: [],
				model_stats: [],
				service_breakdown: [],
			};

			const updateEvent: MetricsStreamEvent = {
				type: "analytics_update",
				message: "Minimal update",
				timestamp: "2024-01-15T13:00:00Z",
				data: minimalUpdate,
			};

			// Act
			mockSSEConnection.emitMessage(updateEvent);
			await flushPromises();
			await tick();

			// Assert data updates work with minimal data
			expect(screen.getByText("500")).toBeInTheDocument();
			expect(screen.getByText("95.0%")).toBeInTheDocument();
			expect(screen.getByText("200s")).toBeInTheDocument();
			expect(screen.getByText("$0.0000")).toBeInTheDocument();

			// Assert notification shows basic info
			expect(screen.getByText(/500 requests/)).toBeInTheDocument();
		});

		it("should auto-remove notifications after timeout", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Create test event
			const testEvent: MetricsStreamEvent = {
				type: "connection",
				message: "Test notification",
				timestamp: "2024-01-15T13:00:00Z",
			};

			// Act
			mockSSEConnection.emitMessage(testEvent);
			await flushPromises();
			await tick();

			// Assert notification is present
			expect(screen.getByText("Connected: Test notification")).toBeInTheDocument();

			// Act - Advance time by 5 seconds
			vi.advanceTimersByTime(5000);
			await flushPromises();
			await tick();

			// Assert notification is removed
			expect(
				screen.queryByText("Connected: Test notification")
			).not.toBeInTheDocument();
		});

		it("should limit notifications to maximum of 5", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Act - Send 7 notifications
			for (let i = 1; i <= 7; i++) {
				const testEvent: MetricsStreamEvent = {
					type: "connection",
					message: `Test notification ${i}`,
					timestamp: "2024-01-15T13:00:00Z",
				};

				mockSSEConnection.emitMessage(testEvent);
				await flushPromises();
				await tick();
			}

			// Assert only 5 notifications are visible (plus initial connection notification)
			const allNotifications = screen.getAllByText(/Connected:/);
			expect(allNotifications.length).toBeLessThanOrEqual(6); // 5 + 1 initial

			// Assert latest notifications are kept
			expect(screen.getByText("Connected: Test notification 7")).toBeInTheDocument();
			expect(screen.getByText("Connected: Test notification 6")).toBeInTheDocument();
			expect(screen.getByText("Connected: Test notification 5")).toBeInTheDocument();
		});
	});

	describe("Filter Integration with SSE", () => {
		it("should maintain SSE connection when filters change", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Get initial connection count
			const initialCallCount = (metricsApi.createSSEConnection as any).mock.calls
				.length;

			// Act - Change time range filter
			const timeRangeSelect = screen.getByDisplayValue("Last 24 Hours");
			// Create custom event with target property
			const changeEvent = new Event("change");
			Object.defineProperty(changeEvent, "target", { value: { value: "6" } });
			timeRangeSelect.dispatchEvent(changeEvent);
			await flushPromises();
			await tick();

			// Assert API was called with new parameters
			expect(metricsApi.getAnalytics).toHaveBeenCalledWith({
				hours: 6,
			});

			// Assert SSE connection was not recreated
			expect((metricsApi.createSSEConnection as any).mock.calls.length).toBe(
				initialCallCount
			);
		});

		it("should handle service type filter changes", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Act - Change service type filter
			const serviceSelect = screen.getByDisplayValue("All Services");
			// Create custom event with target property
			const serviceChangeEvent = new Event("change");
			Object.defineProperty(serviceChangeEvent, "target", {
				value: { value: "anthropic" },
			});
			serviceSelect.dispatchEvent(serviceChangeEvent);
			await flushPromises();
			await tick();

			// Assert API was called with service type filter
			expect(metricsApi.getAnalytics).toHaveBeenCalledWith({
				hours: 24,
				service_type: "anthropic",
			});
		});

		it("should handle model filter changes", async () => {
			// Arrange
			render(DashboardPage);
			await flushPromises();

			// Act - Change model filter
			const modelSelect = screen.getByDisplayValue("All Models");
			// Create custom event with target property
			const modelChangeEvent = new Event("change");
			Object.defineProperty(modelChangeEvent, "target", {
				value: { value: "claude-3-sonnet" },
			});
			modelSelect.dispatchEvent(modelChangeEvent);
			await flushPromises();
			await tick();

			// Assert API was called with model filter
			expect(metricsApi.getAnalytics).toHaveBeenCalledWith({
				hours: 24,
				model: "claude-3-sonnet",
			});
		});
	});
});
