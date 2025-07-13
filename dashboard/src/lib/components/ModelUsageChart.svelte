<script lang="ts">
import ChartContainer from "./ChartContainer.svelte";
import type { ChartData, ChartOptions } from "chart.js";
import { DASHBOARD_CONFIG } from "$lib/utils/constants";
import { formatNumber, getChartColor } from "$lib/utils/formatters";

interface Props {
	modelUsage: Record<string, number> | undefined | null;
	class?: string;
}

const { modelUsage, class: className = "" }: Props = $props();

// Prepare chart data
const chartData = $derived(() => {
	if (!modelUsage || typeof modelUsage !== "object") {
		return {
			labels: [],
			datasets: [
				{
					label: "Requests",
					data: [],
					backgroundColor: [],
					borderRadius: 6,
					borderSkipped: false,
				},
			],
		};
	}

	const entries = Object.entries(modelUsage);
	const labels = entries.map(([model]) => model);
	const data = entries.map(([, count]) => count);
	const colors = labels.map((_, index) => getChartColor(index));

	return {
		labels,
		datasets: [
			{
				label: "Requests",
				data,
				backgroundColor: colors,
				borderRadius: 6,
				borderSkipped: false,
			},
		],
	};
});

// Chart options
const chartOptions: ChartOptions = {
	...DASHBOARD_CONFIG.CHART_DEFAULTS,
	indexAxis: "y" as const,
	plugins: {
		...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins,
		tooltip: {
			...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins!.tooltip,
			callbacks: {
				label: (context) => `Requests: ${formatNumber(context.parsed.x)}`,
			},
		},
	},
	scales: {
		x: {
			...DASHBOARD_CONFIG.CHART_DEFAULTS.scales!.y,
			beginAtZero: true,
			ticks: {
				callback: (value) => formatNumber(Number(value)),
			},
		},
		y: {
			...DASHBOARD_CONFIG.CHART_DEFAULTS.scales!.x,
		},
	},
};
</script>

<ChartContainer
	type="bar"
	data={chartData}
	options={chartOptions}
	class={className}
/>
