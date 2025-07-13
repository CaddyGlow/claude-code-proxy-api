<script lang="ts">

import type { MetricsSummary, ModelUsageData } from "$lib/types/metrics";

interface Props {
	summary?: MetricsSummary | null;
	modelData?: ModelUsageData[];
	class?: string;
}

const { summary, modelData, class: className = "" }: Props = $props();

// Prepare chart data using $derived for reactivity - prioritize new modelData
const chartData = $derived.by(() => {
	// Use new modelData if available, otherwise fall back to legacy summary
	if (modelData && modelData.length > 0) {
		return modelData.map((model, index) => ({
			label: model.model,
			value: model.request_count,
			percentage: model.percentage,
			avgResponseTime: model.avg_response_time,
			totalCost: model.total_cost,
			color: colors[index % colors.length],
		}));
	}

	// Legacy fallback
	if (!summary) {
		return [];
	}

	const modelUsage = summary.models ?? summary.model_usage ?? {};
	const total = Object.values(modelUsage).reduce(
		(sum, count) => sum + count,
		0,
	);

	return Object.entries(modelUsage)
		.map(([model, count], index) => ({
			label: model,
			value: count,
			percentage: total > 0 ? (count / total) * 100 : 0,
			avgResponseTime: 0, // Not available in legacy data
			totalCost: 0, // Not available in legacy data
			color: colors[index % colors.length],
		}))
		.sort((a, b) => b.value - a.value); // Sort by usage count
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

// Transform data for LayerChart Arc component - LayerChart expects hierarchical data
const _arcData = $derived(() => {
	if (chartData.length === 0) return null;

	// Create hierarchical data structure that LayerChart expects
	return {
		children: chartData.map((item, _index) => ({
			id: item.label,
			label: item.label,
			value: item.value, // Use actual request count for sizing
			percentage: item.percentage,
			avgResponseTime: item.avgResponseTime,
			totalCost: item.totalCost,
			color: item.color,
		})),
	};
});

// Chart dimensions for pie chart
const _pieSize = 200;
const _padding = { top: 20, right: 20, bottom: 20, left: 20 };
</script>

<div class="w-full {className}">
	<div class="bg-white rounded-lg shadow p-6">
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Model Usage</h3>

		{#if chartData.length === 0}
			<div class="h-64 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
				<p class="text-gray-500">No model usage data available</p>
			</div>
		{:else}
			<div class="flex flex-col lg:flex-row gap-6">
				<!-- Simple Pie Chart Visualization -->
				<div class="flex-1">
					<div class="h-64 w-full flex items-center justify-center">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
							{#each chartData as model}
								<div class="border rounded-lg p-4">
									<div class="flex items-center justify-between mb-2">
										<h4 class="font-medium text-gray-900">{model.label}</h4>
										<span class="text-sm text-gray-500">{model.percentage.toFixed(1)}%</span>
									</div>
									<div class="space-y-1 text-sm text-gray-600">
										<div class="flex justify-between">
											<span>Requests:</span>
											<span class="font-medium">{model.value.toLocaleString()}</span>
										</div>
										{#if model.avgResponseTime > 0}
											<div class="flex justify-between">
												<span>Avg Response:</span>
												<span class="font-medium">{model.avgResponseTime.toFixed(3)}s</span>
											</div>
										{/if}
										{#if model.totalCost > 0}
											<div class="flex justify-between">
												<span>Total Cost:</span>
												<span class="font-medium">${model.totalCost.toFixed(4)}</span>
											</div>
										{/if}
									</div>
									<!-- Progress bar showing percentage -->
									<div class="mt-2">
										<div class="w-full bg-gray-200 rounded-full h-2">
											<div
												class="h-2 rounded-full transition-all duration-300"
												style="width: {model.percentage}%; background-color: {model.color}"
											></div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- Enhanced Legend -->
				<div class="lg:w-64">
					<h4 class="text-sm font-medium text-gray-700 mb-3">Models</h4>
					<div class="space-y-2">
						{#each chartData as model}
							<div class="flex items-center justify-between">
								<div class="flex items-center space-x-2">
									<div
										class="w-3 h-3 rounded-full"
										style="background-color: {model.color}"
									></div>
									<span class="text-sm text-gray-600 truncate" title={model.label}>
										{model.label}
									</span>
								</div>
								<div class="text-right">
									<div class="text-sm font-medium text-gray-900">
										{formatNumber(model.value)}
									</div>
									<div class="text-xs text-gray-500">
										{model.percentage.toFixed(1)}%
									</div>
									{#if model.avgResponseTime > 0}
										<div class="text-xs text-gray-500">
											{model.avgResponseTime.toFixed(2)}s avg
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<!-- Enhanced Statistics -->
					{#if chartData.length > 0}
						<div class="mt-4 pt-3 border-t border-gray-200">
							<h5 class="text-xs font-medium text-gray-700 mb-2">Summary</h5>
							<div class="space-y-1 text-xs text-gray-600">
								<div class="flex justify-between">
									<span>Total Models:</span>
									<span class="font-medium">{chartData.length}</span>
								</div>
								<div class="flex justify-between">
									<span>Total Requests:</span>
									<span class="font-medium">{chartData.reduce((sum, m) => sum + m.value, 0).toLocaleString()}</span>
								</div>
								{#if chartData.some(m => m.totalCost > 0)}
									<div class="flex justify-between">
										<span>Total Cost:</span>
										<span class="font-medium">${chartData.reduce((sum, m) => sum + m.totalCost, 0).toFixed(4)}</span>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
