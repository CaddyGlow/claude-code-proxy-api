import { type Page, type Locator, expect } from "@playwright/test";

export class DashboardPage {
	readonly page: Page;
	readonly heading: Locator;
	readonly metricCards: Locator;
	readonly timeRangeButtons: Locator;
	readonly loadingIndicator: Locator;
	readonly errorMessage: Locator;
	readonly connectionStatus: Locator;

	constructor(page: Page) {
		this.page = page;
		this.heading = page.getByRole("heading", { name: /dashboard/i });
		this.metricCards = page.locator(
			'[role="region"][aria-labelledby*="metric-"]',
		);
		this.timeRangeButtons = page
			.getByRole("button")
			.filter({ hasText: /^(1h|6h|24h|7d)$/ });
		this.loadingIndicator = page.locator('[aria-label="Loading"]');
		this.errorMessage = page.locator('[role="alert"]');
		this.connectionStatus = page.locator('[data-testid="connection-status"]');
	}

	async goto(): Promise<void> {
		await this.page.goto("/");
	}

	async waitForLoad(): Promise<void> {
		await this.page.waitForLoadState("networkidle");
		await expect(this.heading).toBeVisible();
	}

	async selectTimeRange(range: "1h" | "6h" | "24h" | "7d"): Promise<void> {
		await this.page.getByRole("button", { name: range }).click();
	}

	async getMetricCardValue(metricId: string): Promise<string> {
		const card = this.page.locator(`[aria-labelledby="metric-${metricId}"]`);
		const valueElement = card.locator('[aria-describedby*="metric-"]');
		return (await valueElement.textContent()) || "";
	}

	async waitForMetricUpdate(): Promise<void> {
		// Wait for any loading states to complete
		await this.page.waitForTimeout(500);
		await this.page.waitForLoadState("networkidle");
	}

	async checkAccessibility(): Promise<void> {
		// Check for proper ARIA labels
		await expect(this.metricCards.first()).toHaveAttribute("role", "region");

		// Check for keyboard navigation
		await this.timeRangeButtons.first().focus();
		await expect(this.timeRangeButtons.first()).toBeFocused();

		// Check for color contrast (basic check)
		const styles = await this.metricCards.first().evaluate((el) => {
			const computed = getComputedStyle(el);
			return {
				backgroundColor: computed.backgroundColor,
				color: computed.color,
			};
		});

		expect(styles.backgroundColor).toBeTruthy();
		expect(styles.color).toBeTruthy();
	}

	async simulateNetworkError(): Promise<void> {
		await this.page.route("/metrics/**", (route) => {
			route.abort("failed");
		});
	}

	async simulateSlowNetwork(): Promise<void> {
		await this.page.route("/metrics/**", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			await route.continue();
		});
	}

	async mockSSEConnection(events: any[] = []): Promise<void> {
		await this.page.addInitScript((mockEvents) => {
			class MockEventSource {
				url: string;
				readyState = 1;
				onopen: ((event: Event) => void) | null = null;
				onmessage: ((event: MessageEvent) => void) | null = null;
				onerror: ((event: Event) => void) | null = null;

				constructor(url: string) {
					this.url = url;

					setTimeout(() => {
						this.onopen?.(new Event("open"));
					}, 10);

					// Emit mock events
					mockEvents.forEach((event: any, index: number) => {
						setTimeout(
							() => {
								this.onmessage?.(
									new MessageEvent("message", {
										data: JSON.stringify(event),
									}),
								);
							},
							50 + index * 100,
						);
					});
				}

				close(): void {
					this.readyState = 2;
				}

				addEventListener(): void {}
				removeEventListener(): void {}
				dispatchEvent(): boolean {
					return true;
				}
			}

			(window as any).EventSource = MockEventSource;
		}, events);
	}
}
