<script lang="ts">
import type { MetricCard } from "$lib/types/metrics";

interface Props {
	metric: MetricCard;
	class?: string;
	isFlashing?: boolean;
}

const {
	metric,
	class: additionalClass = "",
	isFlashing = false,
}: Props = $props();

// Helper functions
function _getIconSVG(iconType: string): string {
	const icons: Record<string, string> = {
		requests:
			'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>',
		success:
			'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
		time: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
		cost: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>',
	};
	return (
		icons[iconType] ||
		'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
	);
}

function _getIconColorClass(color: string): string {
	const classes: Record<string, string> = {
		blue: "bg-blue-100 text-blue-600",
		green: "bg-green-100 text-green-600",
		yellow: "bg-yellow-100 text-yellow-600",
		purple: "bg-purple-100 text-purple-600",
		red: "bg-red-100 text-red-600",
	};
	return classes[color] || "bg-gray-100 text-gray-600";
}

function _getChangeColorClass(color: string): string {
	const classes: Record<string, string> = {
		green: "text-green-600",
		red: "text-red-600",
		yellow: "text-yellow-600",
	};
	return classes[color] || "text-gray-600";
}
</script>

<div class="bg-white rounded-lg shadow p-6 border border-gray-200 {additionalClass} transition-all duration-300 {isFlashing ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-lg scale-105' : ''}" role="region" aria-labelledby="metric-{metric.id}">
	<div class="flex items-center justify-between">
		<div>
			<p class="text-sm font-medium text-gray-500" id="metric-{metric.id}">{metric.label}</p>
			<p class="text-2xl font-bold text-gray-900 mt-1" aria-describedby="metric-{metric.id}">{metric.value}</p>
		</div>
		<div class="w-12 h-12 {_getIconColorClass(metric.iconColor)} rounded-lg flex items-center justify-center">
			<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				{@html _getIconSVG(metric.icon)}
			</svg>
		</div>
	</div>
	{#if metric.change}
		<div class="mt-2 flex items-center text-sm">
			<span class="{_getChangeColorClass(metric.changeColor || 'gray')}">{metric.change}</span>
			<span class="text-gray-500 ml-1">vs previous period</span>
		</div>
	{/if}
</div>
