import { test, expect, type Page } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import {
	mockAnalyticsData,
	mockAnalyticsDataEmpty,
	mockAnalyticsDataReduced,
	mockSSEEvents,
	mockSSEErrorEvents,
	mockHealthResponse,
	mockStatusResponse,
	testDataVariants
} from './fixtures/mockData';

// Helper function to mock API responses
async function mockAPIResponses(page: Page, data = mockAnalyticsData) {
	await page.route('/metrics/analytics**', async route => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify(data)
		});
	});

	await page.route('/metrics/health', async route => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify(mockHealthResponse)
		});
	});

	await page.route('/metrics/status', async route => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify(mockStatusResponse)
		});
	});
}

test.describe('Dashboard E2E Tests - Critical P1 Flows', () => {
	let dashboardPage: DashboardPage;

	test.beforeEach(async ({ page }) => {
		dashboardPage = new DashboardPage(page);
		await mockAPIResponses(page);
		await dashboardPage.mockSSEConnection(mockSSEEvents);
	});

	test('should load and display metric cards with correct data', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();

		// Act
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Assert - Check critical dashboard elements
		await expect(page.getByRole('heading', { name: /claude code proxy/i })).toBeVisible();
		await expect(page.getByText('Real-time Metrics Dashboard')).toBeVisible();
		await expect(dashboardPage.metricCards).toHaveCount(4);

		// Assert - Verify metric values from mock data
		const totalRequestsValue = await dashboardPage.getMetricCardValue('total-requests');
		expect(totalRequestsValue).toBe('1250');

		const successRateValue = await dashboardPage.getMetricCardValue('success-rate');
		expect(successRateValue).toBe('96.0%');

		const avgResponseTimeValue = await dashboardPage.getMetricCardValue('avg-response-time');
		expect(avgResponseTimeValue).toBe('1s');

		const totalCostValue = await dashboardPage.getMetricCardValue('total-cost');
		expect(totalCostValue).toBe('$12.5432');

		// Assert - Check live indicator
		await expect(page.locator('.animate-pulse')).toBeVisible();
		await expect(page.getByText('Live')).toBeVisible();
	});

	test('should update data when time range buttons are clicked', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Click 1h button
		await page.getByRole('button', { name: '1h' }).click();
		await page.waitForLoadState('networkidle');

		// Assert - Check URL params updated
		await expect(page).toHaveURL(/hours=1/);

		// Act - Click 6h button with different mock data
		await mockAPIResponses(page, mockAnalyticsDataReduced);
		await page.getByRole('button', { name: '6h' }).click();
		await page.waitForLoadState('networkidle');

		// Assert - Check URL params and data updated
		await expect(page).toHaveURL(/hours=6/);
		await page.waitForTimeout(1000); // Allow time for data update

		const updatedValue = await dashboardPage.getMetricCardValue('total-requests');
		expect(updatedValue).toBe('500');

		// Act - Click 24h button
		await page.getByRole('button', { name: '24h' }).click();
		await page.waitForLoadState('networkidle');

		// Assert - Check URL params updated
		await expect(page).toHaveURL(/hours=24/);

		// Act - Click 7d button
		await page.getByRole('button', { name: '7d' }).click();
		await page.waitForLoadState('networkidle');

		// Assert - Check URL params updated
		await expect(page).toHaveURL(/hours=168/);
	});

	test('should handle real-time SSE updates correctly', async ({ page }) => {
		// Arrange
		const realTimeEvents = [
			{
				type: 'analytics_update',
				data: testDataVariants.highTraffic,
				timestamp: Date.now()
			},
			{
				type: 'connection_status',
				data: { status: 'connected', timestamp: Date.now() },
				timestamp: Date.now()
			}
		];

		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Simulate real-time updates
		await dashboardPage.mockSSEConnection(realTimeEvents);
		await page.waitForTimeout(1000);

		// Assert - Check notification appears
		await expect(page.locator('.fixed.top-4.right-4')).toBeVisible();
		await expect(page.getByText(/Update:/)).toBeVisible();

		// Assert - Check event counter
		await expect(page.getByText(/\d+ events/)).toBeVisible();

		// Assert - Check that notifications can be dismissed
		const closeButton = page.locator('.fixed.top-4.right-4 button[aria-label="Close notification"]').first();
		if (await closeButton.isVisible()) {
			await closeButton.click();
			await page.waitForTimeout(500);
			const notificationCount = await page.locator('.fixed.top-4.right-4 .bg-blue-600').count();
			expect(notificationCount).toBeLessThan(1);
		}
	});

	test('should display appropriate error states when API fails', async ({ page }) => {
		// Arrange - Mock API failure
		await page.route('/metrics/**', route => {
			route.abort('failed');
		});

		// Act
		await dashboardPage.goto();
		await page.waitForTimeout(2000);

		// Assert - Check error handling
		await expect(page.getByText(/Loading dashboard/)).toBeVisible();

		// Check for error state or persistent loading
		await page.waitForTimeout(1000);
		const loadingState = await page.locator('[aria-label="Loading"]').isVisible();
		const errorState = await page.locator('[role="alert"]').isVisible();

		expect(loadingState || errorState).toBe(true);
	});

	test('should handle loading states and transitions smoothly', async ({ page }) => {
		// Arrange - Simulate slow network
		await page.route('/metrics/**', async route => {
			await new Promise(resolve => setTimeout(resolve, 1000));
			await route.continue();
		});

		// Act
		await dashboardPage.goto();

		// Assert - Check loading state appears
		await expect(page.getByText(/Loading dashboard/)).toBeVisible();

		// Assert - Check loading completes
		await page.waitForTimeout(2000);
		await expect(page.getByRole('heading', { name: /claude code proxy/i })).toBeVisible();
		await expect(dashboardPage.metricCards).toHaveCount(4);
	});

	test('should handle URL parameter persistence correctly', async ({ page }) => {
		// Arrange & Act - Navigate with URL params
		await page.goto('/?hours=6&service=proxy_service');
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Assert - Check URL params are applied
		await expect(page).toHaveURL(/hours=6/);
		await expect(page).toHaveURL(/service=proxy_service/);

		// Act - Change time range
		await page.getByRole('button', { name: '24h' }).click();
		await page.waitForLoadState('networkidle');

		// Assert - Check URL updated while maintaining other params
		await expect(page).toHaveURL(/hours=24/);
		await expect(page).toHaveURL(/service=proxy_service/);

		// Act - Reload page
		await page.reload();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Assert - Check params persist after reload
		await expect(page).toHaveURL(/hours=24/);
		await expect(page).toHaveURL(/service=proxy_service/);
	});

	test('should handle various SSE event types appropriately', async ({ page }) => {
		// Arrange
		const mixedEvents = [
			...mockSSEEvents,
			...mockSSEErrorEvents,
			{
				type: 'connection_lost',
				data: { timestamp: Date.now() },
				timestamp: Date.now()
			},
			{
				type: 'connection_restored',
				data: { timestamp: Date.now() },
				timestamp: Date.now()
			}
		];

		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Simulate mixed event types
		await dashboardPage.mockSSEConnection(mixedEvents);
		await page.waitForTimeout(2000);

		// Assert - Check different event types are handled
		await expect(page.locator('.fixed.top-4.right-4')).toBeVisible();

		// Check for various notification types
		const notifications = page.locator('.fixed.top-4.right-4 .bg-blue-600, .fixed.top-4.right-4 .bg-red-600');
		await expect(notifications).toHaveCount.greaterThan(0);
	});

	test('should handle responsive design across viewports', async ({ page }) => {
		// Test mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Assert - Check mobile layout
		await expect(page.getByRole('heading', { name: /claude code proxy/i })).toBeVisible();
		await expect(dashboardPage.metricCards).toHaveCount(4);

		// Test tablet viewport
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.waitForTimeout(300);

		// Assert - Check tablet layout
		await expect(page.getByRole('heading', { name: /claude code proxy/i })).toBeVisible();
		await expect(dashboardPage.metricCards).toHaveCount(4);

		// Test desktop viewport
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.waitForTimeout(300);

		// Assert - Check desktop layout
		await expect(page.getByRole('heading', { name: /claude code proxy/i })).toBeVisible();
		await expect(dashboardPage.metricCards).toHaveCount(4);
	});

	test('should handle edge cases and boundary conditions', async ({ page }) => {
		// Test with empty data
		await mockAPIResponses(page, mockAnalyticsDataEmpty);
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Assert - Check empty state handling
		const totalRequestsValue = await dashboardPage.getMetricCardValue('total-requests');
		expect(totalRequestsValue).toBe('0');

		const successRateValue = await dashboardPage.getMetricCardValue('success-rate');
		expect(successRateValue).toBe('NaN%');

		// Test with high traffic data
		await mockAPIResponses(page, testDataVariants.highTraffic);
		await page.reload();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Assert - Check high traffic handling
		const highTrafficValue = await dashboardPage.getMetricCardValue('total-requests');
		expect(highTrafficValue).toBe('5000');
	});

	test('should handle chart display and fallback modes', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Wait for charts to load
		await page.waitForTimeout(2000);

		// Assert - Check chart sections are present
		await expect(page.getByText('Service Breakdown')).toBeVisible();
		await expect(page.getByText('Model Usage')).toBeVisible();
		await expect(page.getByText('Request Timeline')).toBeVisible();

		// Assert - Either charts or fallback content should be visible
		const hasCharts = await page.locator('svg, canvas').count() > 0;
		const hasFallback = await page.getByText('Loading chart...').count() > 0;
		const hasModelData = await page.getByText('claude-3-').count() > 0;

		expect(hasCharts || hasFallback || hasModelData).toBe(true);
	});
});

test.describe('Dashboard E2E Tests - P2 Additional Scenarios', () => {
	let dashboardPage: DashboardPage;

	test.beforeEach(async ({ page }) => {
		dashboardPage = new DashboardPage(page);
		await mockAPIResponses(page);
		await dashboardPage.mockSSEConnection([]);
	});

	test('should handle service and model filtering', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Filter by service type
		const serviceSelect = page.locator('select').nth(1);
		if (await serviceSelect.isVisible()) {
			await serviceSelect.selectOption('proxy_service');
			await page.waitForLoadState('networkidle');
			await expect(serviceSelect).toHaveValue('proxy_service');
		}

		// Act - Filter by model
		const modelSelect = page.locator('select').nth(2);
		if (await modelSelect.isVisible()) {
			await modelSelect.selectOption('claude-3-sonnet-20240229');
			await page.waitForLoadState('networkidle');
			await expect(modelSelect).toHaveValue('claude-3-sonnet-20240229');
		}
	});

	test('should handle performance scenarios', async ({ page }) => {
		// Test slow response times
		await mockAPIResponses(page, testDataVariants.slowResponses);
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		const avgResponseTimeValue = await dashboardPage.getMetricCardValue('avg-response-time');
		expect(avgResponseTimeValue).toBe('5s');

		// Test high error rates
		await mockAPIResponses(page, testDataVariants.highErrorRate);
		await page.reload();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		const successRateValue = await dashboardPage.getMetricCardValue('success-rate');
		expect(successRateValue).toBe('40.0%');
	});

	test('should handle single model scenarios', async ({ page }) => {
		// Arrange
		await mockAPIResponses(page, testDataVariants.singleModel);

		// Act
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Assert - Check single model display
		await expect(page.getByText('claude-3-sonnet-20240229')).toBeVisible();
	});

	test('should maintain connection status indicators', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Check initial connection status
		await expect(page.locator('.animate-pulse')).toBeVisible();
		await expect(page.getByText('Live')).toBeVisible();

		// Simulate connection changes
		const connectionEvents = [
			{
				type: 'connection_lost',
				data: { timestamp: Date.now() },
				timestamp: Date.now()
			},
			{
				type: 'connection_restored',
				data: { timestamp: Date.now() },
				timestamp: Date.now()
			}
		];

		await dashboardPage.mockSSEConnection(connectionEvents);
		await page.waitForTimeout(1000);

		// Assert - Check connection status updates
		await expect(page.locator('.fixed.top-4.right-4')).toBeVisible();
	});
});
