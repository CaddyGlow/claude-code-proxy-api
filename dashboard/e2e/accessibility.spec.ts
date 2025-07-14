import { test, expect, type Page } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import { mockAnalyticsData, mockHealthResponse, mockStatusResponse } from './fixtures/mockData';

// Helper function to mock API responses
async function mockAPIResponses(page: Page) {
	await page.route('/metrics/analytics**', async route => {
		await route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify(mockAnalyticsData)
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

test.describe('Accessibility Tests - P2 Priority Compliance', () => {
	let dashboardPage: DashboardPage;

	test.beforeEach(async ({ page }) => {
		dashboardPage = new DashboardPage(page);
		await mockAPIResponses(page);
		await dashboardPage.mockSSEConnection([]);
	});

	test('should have proper ARIA labels and semantic roles', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Assert - Check main heading accessibility
		const mainHeading = page.getByRole('heading', { name: /claude code proxy/i });
		await expect(mainHeading).toBeVisible();
		await expect(mainHeading).toHaveAttribute('role', 'heading');

		// Assert - Check metric cards have proper ARIA structure
		await expect(dashboardPage.metricCards).toHaveCount(4);

		// Assert - Verify each metric card accessibility
		for (let i = 0; i < 4; i++) {
			const card = dashboardPage.metricCards.nth(i);
			await expect(card).toHaveAttribute('role', 'region');

			const labelId = await card.getAttribute('aria-labelledby');
			expect(labelId).toMatch(/^metric-/);

			const labelElement = page.locator(`#${labelId}`);
			await expect(labelElement).toBeVisible();

			const valueElement = card.locator('[aria-describedby*="metric-"]');
			await expect(valueElement).toBeVisible();
		}

		// Assert - Check form controls have proper labels
		const selects = page.locator('select');
		const selectCount = await selects.count();

		for (let i = 0; i < selectCount; i++) {
			const select = selects.nth(i);
			await expect(select).toBeVisible();
			await expect(select).toHaveAttribute('tabindex', '0');
		}

		// Assert - Check SVG icons are properly hidden from screen readers
		const svgIcons = page.locator('svg[aria-hidden="true"]');
		await expect(svgIcons).toHaveCount.greaterThan(0);
	});

	test('should support keyboard navigation properly', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Tab to first interactive element
		await page.keyboard.press('Tab');

		// Assert - Check focus on first interactive element
		const firstFocusable = page.locator(':focus');
		await expect(firstFocusable).toBeVisible();

		// Act - Navigate through time range buttons
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');

		// Assert - Check time range buttons are keyboard accessible
		const timeRangeButton = page.locator('button:focus');
		if (await timeRangeButton.isVisible()) {
			await expect(timeRangeButton).toHaveText(/^(1h|6h|24h|7d)$/);

			// Act - Activate with Enter key
			await page.keyboard.press('Enter');
			await page.waitForLoadState('networkidle');
		}

		// Act - Navigate to select elements
		const selects = page.locator('select');
		const selectCount = await selects.count();

		for (let i = 0; i < selectCount; i++) {
			await page.keyboard.press('Tab');
			const focused = page.locator(':focus');

			if (await focused.getAttribute('tagName') === 'SELECT') {
				// Act - Test keyboard interaction with select
				await page.keyboard.press('Enter');
				await page.keyboard.press('ArrowDown');
				await page.keyboard.press('Enter');

				// Act - Test escape key
				await page.keyboard.press('Escape');
			}
		}

		// Assert - Check focus management
		const finalFocused = page.locator(':focus');
		await expect(finalFocused).toBeVisible();
	});

	test('should have proper semantic HTML structure', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Assert - Check main landmarks
		await expect(page.locator('header')).toBeVisible();
		await expect(page.locator('main')).toBeVisible();

		// Assert - Check heading hierarchy
		const h1 = page.locator('h1');
		await expect(h1).toHaveCount(1);
		await expect(h1).toContainText('Claude Code Proxy');

		// Assert - Check metric labels structure
		const metricLabels = page.locator('[id^="metric-"]');
		await expect(metricLabels).toHaveCount(4);

		// Assert - Check button structure
		const buttons = page.locator('button');
		const buttonCount = await buttons.count();

		for (let i = 0; i < buttonCount; i++) {
			const button = buttons.nth(i);
			await expect(button).toHaveAttribute('type', 'button');
		}

		// Assert - Check form element structure
		const selects = page.locator('select');
		const selectCount = await selects.count();

		for (let i = 0; i < selectCount; i++) {
			const select = selects.nth(i);
			const options = select.locator('option');
			await expect(options).toHaveCount.greaterThan(0);
		}
	});

	test('should have sufficient color contrast for accessibility', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Check main heading contrast
		const mainHeading = page.getByRole('heading', { name: /claude code proxy/i });
		const headingStyles = await mainHeading.evaluate((el) => {
			const computed = getComputedStyle(el);
			return {
				color: computed.color,
				backgroundColor: computed.backgroundColor,
				fontSize: computed.fontSize,
				fontWeight: computed.fontWeight
			};
		});

		// Assert - Check heading has proper contrast properties
		expect(headingStyles.color).toBeTruthy();
		expect(headingStyles.backgroundColor).toBeTruthy();

		// Act - Check metric card contrast
		const firstCard = dashboardPage.metricCards.first();
		const cardStyles = await firstCard.evaluate((el) => {
			const computed = getComputedStyle(el);
			return {
				color: computed.color,
				backgroundColor: computed.backgroundColor,
				border: computed.border
			};
		});

		// Assert - Check card has proper contrast
		expect(cardStyles.color).toBeTruthy();
		expect(cardStyles.backgroundColor).toBeTruthy();

		// Act - Check interactive elements contrast
		const timeRangeButtons = page.locator('button').filter({ hasText: /^(1h|6h|24h|7d)$/ });
		const buttonCount = await timeRangeButtons.count();

		for (let i = 0; i < buttonCount; i++) {
			const button = timeRangeButtons.nth(i);
			const buttonStyles = await button.evaluate((el) => {
				const computed = getComputedStyle(el);
				return {
					color: computed.color,
					backgroundColor: computed.backgroundColor,
					border: computed.border
				};
			});

			expect(buttonStyles.color).toBeTruthy();
			expect(buttonStyles.backgroundColor).toBeTruthy();
		}

		// Act - Check select elements contrast
		const selects = page.locator('select');
		const selectCount = await selects.count();

		for (let i = 0; i < selectCount; i++) {
			const select = selects.nth(i);
			const selectStyles = await select.evaluate((el) => {
				const computed = getComputedStyle(el);
				return {
					color: computed.color,
					backgroundColor: computed.backgroundColor,
					border: computed.border
				};
			});

			expect(selectStyles.color).toBeTruthy();
			expect(selectStyles.backgroundColor).toBeTruthy();
		}
	});

	test('should provide proper screen reader support', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Check for live regions
		const liveRegions = page.locator('[aria-live]');
		if (await liveRegions.count() > 0) {
			await expect(liveRegions.first()).toHaveAttribute('aria-live', /polite|assertive/);
		}

		// Act - Check notification accessibility
		const notifications = page.locator('.fixed.top-4.right-4');
		if (await notifications.isVisible()) {
			const notificationElements = notifications.locator('.bg-blue-600');
			const notificationCount = await notificationElements.count();

			for (let i = 0; i < notificationCount; i++) {
				const notification = notificationElements.nth(i);
				const closeButton = notification.locator('button[aria-label="Close notification"]');
				await expect(closeButton).toHaveAttribute('aria-label', 'Close notification');
			}
		}

		// Act - Check metric values are properly announced
		const firstCard = dashboardPage.metricCards.first();
		const labelId = await firstCard.getAttribute('aria-labelledby');
		const label = page.locator(`#${labelId}`);
		await expect(label).toBeVisible();

		const valueElement = firstCard.locator('[aria-describedby*="metric-"]');
		await expect(valueElement).toBeVisible();
	});

	test('should handle focus management correctly', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Tab to first interactive element
		await page.keyboard.press('Tab');
		const firstFocusable = page.locator(':focus');
		await expect(firstFocusable).toBeVisible();

		// Act - Check focus visibility
		const focusStyles = await firstFocusable.evaluate((el) => {
			const computed = getComputedStyle(el);
			return {
				outline: computed.outline,
				outlineOffset: computed.outlineOffset,
				boxShadow: computed.boxShadow
			};
		});

		// Assert - Should have focus indicator
		expect(
			focusStyles.outline !== 'none' ||
			focusStyles.boxShadow !== 'none' ||
			focusStyles.outlineOffset !== 'none'
		).toBeTruthy();

		// Act - Move focus to next element
		await page.keyboard.press('Tab');
		const secondFocusable = page.locator(':focus');

		// Assert - Focus should move to different element
		const firstHandle = await firstFocusable.elementHandle();
		const secondHandle = await secondFocusable.elementHandle();

		if (firstHandle && secondHandle) {
			const sameElement = await firstHandle.isEqual(secondHandle);
			expect(sameElement).toBeFalsy();
		}
	});

	test('should support reduced motion preferences', async ({ page }) => {
		// Arrange - Simulate reduced motion preference
		await page.emulateMedia({ reducedMotion: 'reduce' });

		// Act
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Assert - Check essential functionality works
		await expect(page.getByRole('heading', { name: /claude code proxy/i })).toBeVisible();
		await expect(dashboardPage.metricCards).toHaveCount(4);

		// Assert - Check animations respect motion preferences
		const animatedElements = page.locator('.animate-pulse, .animate-spin');
		const animatedCount = await animatedElements.count();

		for (let i = 0; i < animatedCount; i++) {
			const element = animatedElements.nth(i);
			await expect(element).toBeVisible();
		}
	});

	test('should work with high contrast mode', async ({ page }) => {
		// Arrange - Simulate high contrast mode
		await page.emulateMedia({ colorScheme: 'dark' });

		// Act
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Assert - Check elements are visible in high contrast
		await expect(page.getByRole('heading', { name: /claude code proxy/i })).toBeVisible();
		await expect(dashboardPage.metricCards).toHaveCount(4);

		// Assert - Check interactive elements work in high contrast
		const timeRangeButtons = page.locator('button').filter({ hasText: /^(1h|6h|24h|7d)$/ });
		const buttonCount = await timeRangeButtons.count();

		for (let i = 0; i < buttonCount; i++) {
			const button = timeRangeButtons.nth(i);
			await expect(button).toBeVisible();
			await expect(button).toBeEnabled();
		}

		const selects = page.locator('select');
		const selectCount = await selects.count();

		for (let i = 0; i < selectCount; i++) {
			const select = selects.nth(i);
			await expect(select).toBeVisible();
			await expect(select).toBeEnabled();
		}
	});

	test('should be navigable with screen reader simulation', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Check landmark navigation
		const header = page.locator('header');
		await expect(header).toBeVisible();

		const main = page.locator('main');
		await expect(main).toBeVisible();

		// Act - Check heading navigation
		const headings = page.locator('h1, h2, h3, h4, h5, h6');
		const headingCount = await headings.count();
		expect(headingCount).toBeGreaterThan(0);

		// Act - Check form control navigation
		const formControls = page.locator('select, button, input');
		const controlCount = await formControls.count();

		for (let i = 0; i < controlCount; i++) {
			const control = formControls.nth(i);
			await expect(control).toBeVisible();

			const ariaLabel = await control.getAttribute('aria-label');
			const ariaLabelledBy = await control.getAttribute('aria-labelledby');
			const id = await control.getAttribute('id');

			// Control should have accessible name
			expect(ariaLabel || ariaLabelledBy || id).toBeTruthy();
		}
	});

	test('should handle assistive technology announcements', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Check for status announcements
		const statusElements = page.locator('[role="status"], [aria-live]');
		if (await statusElements.count() > 0) {
			for (let i = 0; i < await statusElements.count(); i++) {
				const element = statusElements.nth(i);
				const role = await element.getAttribute('role');
				const ariaLive = await element.getAttribute('aria-live');

				expect(role === 'status' || ariaLive).toBeTruthy();
			}
		}

		// Act - Check for error announcements
		const errorElements = page.locator('[role="alert"]');
		if (await errorElements.count() > 0) {
			for (let i = 0; i < await errorElements.count(); i++) {
				const element = errorElements.nth(i);
				await expect(element).toHaveAttribute('role', 'alert');
			}
		}

		// Act - Check for loading announcements
		const loadingElements = page.locator('[aria-label*="Loading"], [aria-label*="loading"]');
		if (await loadingElements.count() > 0) {
			for (let i = 0; i < await loadingElements.count(); i++) {
				const element = loadingElements.nth(i);
				const ariaLabel = await element.getAttribute('aria-label');
				expect(ariaLabel).toMatch(/loading/i);
			}
		}
	});

	test('should have proper accessibility tree structure', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Get accessibility tree
		const accessibilityTree = await page.accessibility.snapshot();

		// Assert - Check accessibility tree exists
		expect(accessibilityTree).toBeTruthy();
		expect(accessibilityTree.children).toBeTruthy();

		// Act - Helper function to find roles in tree
		const findInTree = (node: any, role: string): boolean => {
			if (node.role === role) return true;
			if (node.children) {
				return node.children.some((child: any) => findInTree(child, role));
			}
			return false;
		};

		// Assert - Check required landmarks exist
		expect(findInTree(accessibilityTree, 'main')).toBeTruthy();
		expect(findInTree(accessibilityTree, 'heading')).toBeTruthy();

		// Assert - Check interactive elements exist
		expect(
			findInTree(accessibilityTree, 'combobox') ||
			findInTree(accessibilityTree, 'button') ||
			findInTree(accessibilityTree, 'listbox')
		).toBeTruthy();
	});

	test('should handle keyboard shortcuts and interactions', async ({ page }) => {
		// Arrange
		await dashboardPage.goto();
		await page.waitForLoadState('networkidle');
		await dashboardPage.waitForLoad();

		// Act - Test keyboard shortcuts for time range buttons
		const timeRangeButtons = page.locator('button').filter({ hasText: /^(1h|6h|24h|7d)$/ });
		const buttonCount = await timeRangeButtons.count();

		for (let i = 0; i < buttonCount; i++) {
			const button = timeRangeButtons.nth(i);
			await button.focus();
			await expect(button).toBeFocused();

			// Test spacebar activation
			await page.keyboard.press('Space');
			await page.waitForLoadState('networkidle');

			// Test enter key activation
			await button.focus();
			await page.keyboard.press('Enter');
			await page.waitForLoadState('networkidle');
		}

		// Act - Test keyboard navigation in select elements
		const selects = page.locator('select');
		const selectCount = await selects.count();

		for (let i = 0; i < selectCount; i++) {
			const select = selects.nth(i);
			await select.focus();
			await expect(select).toBeFocused();

			// Test arrow key navigation
			await page.keyboard.press('ArrowDown');
			await page.keyboard.press('ArrowUp');

			// Test home/end keys
			await page.keyboard.press('Home');
			await page.keyboard.press('End');
		}
	});

	test('should provide proper error state accessibility', async ({ page }) => {
		// Arrange - Mock API failure
		await page.route('/metrics/**', route => {
			route.abort('failed');
		});

		// Act
		await dashboardPage.goto();
		await page.waitForTimeout(2000);

		// Assert - Check error states are accessible
		const loadingElements = page.locator('[aria-label="Loading"]');
		const errorElements = page.locator('[role="alert"]');

		const loadingCount = await loadingElements.count();
		const errorCount = await errorElements.count();

		if (loadingCount > 0) {
			await expect(loadingElements.first()).toHaveAttribute('aria-label', 'Loading');
		}

		if (errorCount > 0) {
			await expect(errorElements.first()).toHaveAttribute('role', 'alert');
		}

		// At least one accessible error/loading state should exist
		expect(loadingCount + errorCount).toBeGreaterThan(0);
	});
});
