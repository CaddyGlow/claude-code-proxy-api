<script lang="ts">
import type { ModelUsageData } from "$lib/types/metrics";

// Utility function for formatting numbers
function _formatNumber(num: number): string {
	if (num >= 1000000) {
		return `${(num / 1000000).toFixed(1)}M`;
	}
	if (num >= 1000) {
		return `${(num / 1000).toFixed(1)}K`;
	}
	return num.toString();
}

interface Props {
	modelData?: ModelUsageData[];
}

const { modelData }: Props = $props();

// Prepare chart data using $derived for reactivity
const _chartData = $derived.by(() => {
	if (!modelData || modelData.length === 0) {
		return [];
	}

	return modelData.map((model, index) => ({
		label: model.model,
		value: model.request_count,
		percentage: model.percentage,
		avgResponseTime: model.avg_response_time,
		totalCost: model.total_cost,
		color: colors[index % colors.length],
	}));
});

// Color scheme for different models
const colors = [
	"rgb(59, 130, 246)", // blue-500
	"rgb(34, 197, 94)", // green-500
	"rgb(251, 146, 60)", // orange-400
	"rgb(168, 85, 247)", // purple-500
	"rgb(236, 72, 153)", // pink-500
	"rgb(14, 165, 233)", // sky-500
	"rgb(132, 204, 22)", // lime-500
	"rgb(245, 101, 101)", // red-400
];
</script>

<div class="w-full {className}">
	<div class="bg-white rounded-lg shadow p-6">
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Model Usage</h3>

		{#if _chartData.length === 0}
			<div class="h-64 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
				<p class="text-gray-500">No model usage data available</p>
			</div>
		{:else}
			<!-- Improved Grid Layout with Better Alignment -->
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{#each _chartData as model}
					<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
						<!-- Model Header with Color Indicator -->
						<div class="flex items-center justify-between mb-3">
							<div class="flex items-center space-x-2">
								<div
									class="w-3 h-3 rounded-full"
									style="background-color: {model.color}"
								></div>
								<h4 class="font-semibold text-gray-900 truncate" title={model.label}>
									{model.label}
								</h4>
							</div>
							<span class="text-lg font-bold text-gray-700">{model.percentage.toFixed(1)}%</span>
						</div>

						<!-- Metrics Grid -->
						<div class="grid grid-cols-2 gap-3 mb-3 text-sm">
							<div class="text-center">
								<div class="text-xs text-gray-500 uppercase tracking-wide">Requests</div>
								<div class="font-semibold text-gray-900 px-2 py-1 rounded transition-all duration-700 {isFlashing ? 'bg-blue-200' : ''}">{_formatNumber(model.value)}</div>
							</div>
							<div class="text-center">
								<div class="text-xs text-gray-500 uppercase tracking-wide">Avg Response</div>
								<div class="font-semibold text-gray-900 px-2 py-1 rounded transition-all duration-700 {isFlashing ? 'bg-blue-200' : ''}">
									{model.avgResponseTime > 0 ? `${model.avgResponseTime.toFixed(2)}s` : 'N/A'}
								</div>
							</div>
						</div>

						<!-- Cost Display -->
						{#if model.totalCost > 0}
							<div class="text-center mb-3">
								<div class="text-xs text-gray-500 uppercase tracking-wide">Total Cost</div>
								<div class="font-semibold text-green-600 px-2 py-1 rounded transition-all duration-700 {isFlashing ? 'bg-blue-200' : ''}">${model.totalCost.toFixed(4)}</div>
							</div>
						{/if}

						<!-- Progress Bar -->
						<div class="mt-3">
							<div class="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
								<div
									class="h-full rounded-full transition-all duration-500 ease-out"
									style="width: {model.percentage}%; background-color: {model.color}"
								></div>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Summary Statistics -->
			{#if _chartData.length > 0}
				<div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
					<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
						<div>
							<div class="text-sm text-blue-600 font-medium">Total Models</div>
							<div class="text-2xl font-bold text-blue-800 px-2 py-1 rounded transition-all duration-700 {isFlashing ? 'bg-white' : ''}">{_chartData.length}</div>
						</div>
						<div>
							<div class="text-sm text-blue-600 font-medium">Total Requests</div>
							<div class="text-2xl font-bold text-blue-800 px-2 py-1 rounded transition-all duration-700 {isFlashing ? 'bg-white' : ''}">{_chartData.reduce((sum: number, m) => sum + m.value, 0).toLocaleString()}</div>
						</div>
						<div>
							<div class="text-sm text-blue-600 font-medium">Avg Response Time</div>
							<div class="text-2xl font-bold text-blue-800 px-2 py-1 rounded transition-all duration-700 {isFlashing ? 'bg-white' : ''}">
								{(_chartData.reduce((sum: number, m) => sum + m.avgResponseTime, 0) / _chartData.length).toFixed(2)}s
							</div>
						</div>
						{#if _chartData.some(m => m.totalCost > 0)}
							<div>
								<div class="text-sm text-blue-600 font-medium">Total Cost</div>
								<div class="text-2xl font-bold text-green-600 px-2 py-1 rounded transition-all duration-700 {isFlashing ? 'bg-white' : ''}">
									${_chartData.reduce((sum: number, m) => sum + m.totalCost, 0).toFixed(4)}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
