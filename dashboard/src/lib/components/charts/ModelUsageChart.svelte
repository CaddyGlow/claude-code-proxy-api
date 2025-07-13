<script lang="ts">
import type { MetricsSummary } from "$lib/types/metrics";
import { formatNumber } from "$lib/utils/formatters";

interface Props {
	summary: MetricsSummary | null;
	class?: string;
}

const { summary, class: className = "" }: Props = $props();

// Prepare chart data using $derived for reactivity
const chartData = $derived.by(() => {
	if (!summary) {
		return [];
	}

	// Use either models or model_usage field from API
	const modelUsage = summary.models ?? summary.model_usage ?? {};

	const total = Object.values(modelUsage).reduce((sum, count) => sum + count, 0);

	return Object.entries(modelUsage)
		.map(([model, count]) => ({
			label: model,
			value: count,
			percentage: total > 0 ? (count / total) * 100 : 0,
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

// Simple SVG pie chart function
function createPieSlices(data: typeof chartData) {
	let cumulativePercentage = 0;
	const radius = 80;
	const centerX = 100;
	const centerY = 100;

	return data.map((item, index) => {
		const startAngle = (cumulativePercentage / 100) * 2 * Math.PI;
		const endAngle = ((cumulativePercentage + item.percentage) / 100) * 2 * Math.PI;

		const x1 = centerX + radius * Math.cos(startAngle);
		const y1 = centerY + radius * Math.sin(startAngle);
		const x2 = centerX + radius * Math.cos(endAngle);
		const y2 = centerY + radius * Math.sin(endAngle);

		const largeArcFlag = item.percentage > 50 ? 1 : 0;

		const pathData = [
			`M ${centerX} ${centerY}`,
			`L ${x1} ${y1}`,
			`A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
			'Z'
		].join(' ');

		cumulativePercentage += item.percentage;

		return {
			...item,
			pathData,
			color: colors[index % colors.length],
		};
	});
}

const pieSlices = $derived(createPieSlices(chartData));
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
				<!-- Pie Chart -->
				<div class="flex-1">
					<div class="h-64 w-full flex items-center justify-center">
						<svg width="200" height="200" viewBox="0 0 200 200" class="drop-shadow-sm">
							{#each pieSlices as slice, index}
								<path
									d={slice.pathData}
									fill={slice.color}
									stroke="white"
									stroke-width="2"
									class="hover:opacity-80 transition-opacity cursor-pointer"
									title="{slice.label}: {formatNumber(slice.value)} requests ({slice.percentage.toFixed(1)}%)"
								/>
							{/each}
						</svg>
					</div>
				</div>

				<!-- Legend -->
				<div class="lg:w-64">
					<h4 class="text-sm font-medium text-gray-700 mb-3">Models</h4>
					<div class="space-y-2">
						{#each pieSlices as slice}
							<div class="flex items-center justify-between">
								<div class="flex items-center space-x-2">
									<div
										class="w-3 h-3 rounded-full"
										style="background-color: {slice.color}"
									></div>
									<span class="text-sm text-gray-600 truncate" title={slice.label}>
										{slice.label}
									</span>
								</div>
								<div class="text-right">
									<div class="text-sm font-medium text-gray-900">
										{formatNumber(slice.value)}
									</div>
									<div class="text-xs text-gray-500">
										{slice.percentage.toFixed(1)}%
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
