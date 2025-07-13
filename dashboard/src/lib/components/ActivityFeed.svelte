<script lang="ts">
import type { ActivityItem } from "../types.js";

interface Props {
	items: ActivityItem[];
	isLoading?: boolean;
	class?: string;
}

const { items, isLoading = false, class: additionalClass = "" }: Props = $props();

let feedContainer: HTMLDivElement;

// Derived state for empty state
const isEmpty = $derived(items.length === 0);

// Auto-scroll to bottom when new items are added
$effect(() => {
	if (feedContainer && items.length > 0) {
		const wasScrolledToBottom =
			feedContainer.scrollTop + feedContainer.clientHeight >=
			feedContainer.scrollHeight - 5; // 5px tolerance

		if (wasScrolledToBottom) {
			feedContainer.scrollTop = feedContainer.scrollHeight;
		}
	}
});

const getStatusColor = (status: ActivityItem["status"]): string => {
	switch (status) {
		case "success":
			return "bg-green-500";
		case "error":
			return "bg-red-500";
		case "warning":
			return "bg-yellow-500";
		case "info":
			return "bg-blue-500";
		default:
			return "bg-gray-500";
	}
};

const formatTime = (timestamp: string): string => {
	const date = new Date(timestamp);
	return date.toLocaleTimeString("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
};

const truncateText = (text: string, maxLength: number): string => {
	return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
};
</script>

<div
	class="chart-container {additionalClass}"
	role="region"
	aria-label="Live Activity Feed"
>
	<div class="chart-header">
		<h3 class="chart-title">Live Activity</h3>
		<span class="text-sm text-gray-500">Real-time requests</span>
	</div>
	<div
		class="flex-1 min-h-0 overflow-y-auto scrollbar-thin"
		bind:this={feedContainer}
		role="log"
		aria-live="polite"
		aria-label="Activity stream"
	>
		<div class="space-y-2">
			{#if isLoading && isEmpty}
				<div class="text-center text-gray-500 text-sm py-8">
					<div class="spinner mx-auto mb-2" aria-hidden="true"></div>
					<p>Waiting for activity...</p>
				</div>
			{:else if isEmpty}
				<div class="text-center text-gray-500 text-sm py-8">
					<p>No recent activity</p>
				</div>
			{:else}
				{#each items as item (item.id)}
					<div class="activity-item" role="article" aria-label="Activity: {item.title}">
						<div class="flex-shrink-0">
							<div
								class="w-3 h-3 rounded-full {getStatusColor(item.status)}"
								aria-hidden="true"
								title="{item.status} status"
							></div>
						</div>
						<div class="activity-content">
							<div class="activity-title" title="{item.title}">
								{truncateText(item.title, 40)}
							</div>
							<div class="activity-subtitle" title="{item.subtitle}">
								{truncateText(item.subtitle, 50)}
							</div>
						</div>
						<div class="activity-time" title="Time: {new Date(item.timestamp).toLocaleString()}">
							{formatTime(item.timestamp)}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
