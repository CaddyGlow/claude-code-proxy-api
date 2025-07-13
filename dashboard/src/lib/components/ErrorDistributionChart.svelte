<script lang="ts">
import ChartContainer from "./ChartContainer.svelte";
import type { ChartData, ChartOptions } from "chart.js";
import { DASHBOARD_CONFIG } from "$lib/utils/constants";
import { formatNumber, getChartColor } from "$lib/utils/formatters";

interface Props {
	errorTypes: Record<string, number> | undefined | null;
	class?: string;
}

const { errorTypes, class: className = "" }: Props = $props();

// Prepare chart data
const chartData = $derived(() => {
	if (!errorTypes || typeof errorTypes !== "object") {
		return {
			labels: [],
			datasets: [
				{
					data: [],
					backgroundColor: [],
					borderWidth: 0,
				},
			],
		};
	}

	const entries = Object.entries(errorTypes);
	const labels = entries.map(([type]) => type);
	const data = entries.map(([, count]) => count);
	const colors = labels.map((_, index) => getChartColor(index));

	return {
		labels,
		datasets: [
			{
				data,
				backgroundColor: colors,
				borderWidth: 0,
			},
		],
	};
});

// Chart options
const chartOptions: ChartOptions = {
	...DASHBOARD_CONFIG.CHART_DEFAULTS,
	plugins: {
		...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins,
		tooltip: {
			...DASHBOARD_CONFIG.CHART_DEFAULTS.plugins!.tooltip,
			callbacks: {
				label: (context) => {
					const dataset = context.dataset;
					const total = dataset.data.reduce(
						(sum: number, value) => sum + Number(value),
						0,
					);
					const percentage = ((Number(context.parsed) / total) * 100).toFixed(
						1,
					);
					return `${context.label}: ${formatNumber(Number(context.parsed))} (${percentage}%)`;
				},
			},
		},
	},
};
</script>

<ChartContainer
	type="doughnut"
	data={chartData}
	options={chartOptions}
	class={className}
/>
