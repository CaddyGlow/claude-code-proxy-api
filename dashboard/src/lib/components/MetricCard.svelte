<script lang="ts">
import type { MetricCard } from "../types.js";

interface Props {
	metric: MetricCard;
	class?: string;
}

const { metric, class: additionalClass = "" }: Props = $props();

// Generate SVG icon based on icon type
const _getIconSVG = (iconType: string): string => {
	switch (iconType) {
		case "requests":
			return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>';
		case "success":
			return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>';
		case "time":
			return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>';
		case "cost":
			return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>';
		default:
			return '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>';
	}
};

const _getIconColorClass = (color: string): string => {
	switch (color) {
		case "blue":
			return "bg-blue-100 text-blue-600";
		case "green":
			return "bg-green-100 text-green-600";
		case "yellow":
			return "bg-yellow-100 text-yellow-600";
		case "purple":
			return "bg-purple-100 text-purple-600";
		case "red":
			return "bg-red-100 text-red-600";
		default:
			return "bg-gray-100 text-gray-600";
	}
};

const _getChangeColorClass = (color: string): string => {
	switch (color) {
		case "green":
			return "text-green-600";
		case "red":
			return "text-red-600";
		case "yellow":
			return "text-yellow-600";
		default:
			return "text-gray-600";
	}
};
</script>

<div class="metric-card {additionalClass}" role="region" aria-labelledby="metric-{metric.id}">
	<div class="flex items-center justify-between">
		<div>
			<p class="metric-label" id="metric-{metric.id}">{metric.label}</p>
			<p class="metric-value" aria-describedby="metric-{metric.id}">{metric.value}</p>
		</div>
		<div class="w-12 h-12 {getIconColorClass(metric.iconColor)} rounded-lg flex items-center justify-center">
			<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				{@html getIconSVG(metric.icon)}
			</svg>
		</div>
	</div>
	{#if metric.change}
		<div class="mt-2 flex items-center text-sm">
			<span class="{getChangeColorClass(metric.changeColor || 'gray')}">{metric.change}</span>
			<span class="text-gray-500 ml-1">vs previous period</span>
		</div>
	{/if}
</div>
