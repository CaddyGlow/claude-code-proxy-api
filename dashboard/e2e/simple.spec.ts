import { expect, test } from "@playwright/test";

test.describe("Dashboard E2E Tests", () => {
	test("loads dashboard and displays key elements", async ({ page }) => {
		await page.goto("/");

		// Wait for page to load
		await page.waitForLoadState("domcontentloaded");

		// Check that the main dashboard header is visible
		await expect(page.getByText("Claude Code Proxy")).toBeVisible();
		await expect(page.getByText("Real-time Metrics Dashboard")).toBeVisible();

		// Check that the dashboard is either loading or has loaded content
		const loadingSpinner = page.locator(".animate-spin");
		const metricsCards = page.locator('[role="region"]');

		// Wait for either loading to complete or content to appear
		await expect(async () => {
			const spinnerVisible = await loadingSpinner.isVisible();
			const cardsVisible = await metricsCards.first().isVisible();
			expect(spinnerVisible || cardsVisible).toBeTruthy();
		}).toPass({ timeout: 5000 });
	});

	test("displays live status indicator", async ({ page }) => {
		await page.goto("/");

		// Wait for page to load
		await page.waitForLoadState("domcontentloaded");

		// Check for live status indicator
		await expect(page.getByText("Live")).toBeVisible();
		await expect(page.locator(".bg-green-500.animate-pulse")).toBeVisible();
	});

	test("has working time range filter", async ({ page }) => {
		await page.goto("/");

		// Wait for page to load
		await page.waitForLoadState("domcontentloaded");

		// Check that time range selector exists
		const timeRangeSelect = page.locator("select").first();
		await expect(timeRangeSelect).toBeVisible();

		// Check that it has expected options by checking the select value options
		// Note: Select options are not typically "visible" in the DOM sense, so we check for existence
		await expect(timeRangeSelect.locator('option[value="1"]')).toBeAttached();
		await expect(timeRangeSelect.locator('option[value="24"]')).toBeAttached();
		await expect(timeRangeSelect.locator('option[value="168"]')).toBeAttached();

		// Verify we can interact with the select
		await timeRangeSelect.selectOption("1");
		await expect(timeRangeSelect).toHaveValue("1");
	});

	test("has navigation link to entries page", async ({ page }) => {
		await page.goto("/");

		// Wait for page to load
		await page.waitForLoadState("domcontentloaded");

		// Check that entries link exists
		const entriesLink = page.getByRole("link", { name: "Database Entries" });
		await expect(entriesLink).toBeVisible();
		await expect(entriesLink).toHaveAttribute("href", "/metrics/dashboard/entries");
	});

	test("shows advanced filters when toggled", async ({ page }) => {
		await page.goto("/");

		// Wait for page to load
		await page.waitForLoadState("domcontentloaded");

		// Click advanced filters button
		const advancedFiltersButton = page.getByRole("button", {
			name: "Advanced Filters",
		});
		await expect(advancedFiltersButton).toBeVisible();
		await advancedFiltersButton.click();

		// Wait for the advanced filters section to appear (conditional rendering)
		await page.waitForTimeout(1000);

		// Check if the button state changed - it should have a different style when active
		await expect(advancedFiltersButton).toHaveClass(/bg-blue-100/);

		// Check for the advanced filters elements that actually appear
		await expect(page.getByText("Status:")).toBeVisible({ timeout: 5000 });
		await expect(page.getByText("Streaming:")).toBeVisible({ timeout: 5000 });
		await expect(page.getByRole("button", { name: "Clear" })).toBeVisible({
			timeout: 5000,
		});
	});

	test("shows service and model filter inputs", async ({ page }) => {
		await page.goto("/");

		// Wait for page to load
		await page.waitForLoadState("domcontentloaded");

		// Check service filter
		const serviceInput = page.getByPlaceholder(
			"e.g., anthropic_service,openai_service or !access_log"
		);
		await expect(serviceInput).toBeVisible();

		// Check model filter
		const modelInput = page.getByPlaceholder("e.g., claude-3-5-sonnet-20241022");
		await expect(modelInput).toBeVisible();
	});
});
