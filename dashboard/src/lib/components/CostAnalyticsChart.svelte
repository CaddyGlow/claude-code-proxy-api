<script lang="ts">
import ChartContainer from "./ChartContainer.svelte";
import type { ChartData, ChartOptions } from "chart.js";
import type { CostMetric, AnyMetric } from "$lib/types/metrics";
import { DASHBOARD_CONFIG } from "$lib/utils/constants";
import { formatCurrency } from "$lib/utils/formatters";

interface Props {
	costMetrics: CostMetric[];
	class?: string;
}

const { costMetrics, class: className = "" }: Props = $props();

// Group metrics by time interval
function groupMetricsByTime(
	metrics: AnyMetric[],
	interval: "minute" | "hour" | "day" = "hour",
): Record<string, AnyMetric[]> {
	const groups: Record<string, AnyMetric[]> = {};

	metrics.forEach((metric) => {
		const date = new Date(metric.timestamp);
		let key: string;

		switch (interval) {
			case "minute":
				key = date.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
				break;
			case "hour":
				key = date.toISOString().substring(0, 13); // YYYY-MM-DDTHH
				break;
			case "day":
				key = date.toISOString().substring(0, 10); // YYYY-MM-DD
				break;
		}

		if (!groups[key]) {
			groups[key] = [];
		}
		groups[key]!.push(metric);
	});

	return groups;
}

// Prepare chart data
const chartData = $derived(() => {
	if (!costMetrics || costMetrics.length === 0) {
		return {
			labels: [],
			datasets: [
				{
					label: "Cost",
					data: [],
					borderColor: DASHBOARD_CONFIG.COLORS.info,
					backgroundColor: DASHBOARD_CONFIG.COLORS.info + "20",
					fill: true,
					tension: 0.4,
				},
			],
		};
	}

	// Group by time and sum costs
	const timeGroups = groupMetricsByTime(costMetrics, "hour");
	const labels = Object.keys(timeGroups).sort();
	const data = labels.map((label) => {
		return (
			timeGroups[label]?.reduce(
				(sum, metric) => sum + (metric as CostMetric).total_cost,
				0,
			) ?? 0
		);
	});

	return {
		labels,
		datasets: [
			{
				label: "Cost",
				data,
				borderColor: DASHBOARD_CONFIG.COLORS.info,
				backgroundColor: DASHBOARD_CONFIG.COLORS.info + "20",
				fill: true,
				tension: 0.4,
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
				label: (context) => `Cost: ${formatCurrency(context.parsed.y)}`,
			},
		},
	},
	scales: {
		x: {
			type: "time",
			...DASHBOARD_CONFIG.CHART_DEFAULTS.scales!.x,
		},
		y: {
			...DASHBOARD_CONFIG.CHART_DEFAULTS.scales!.y,
			beginAtZero: true,
			ticks: {
				callback: (value) => formatCurrency(Number(value)),
			},
		},
	},
};
</script>

<ChartContainer
	type="line"
	data={chartData}
	options={chartOptions}
	class={className}
/>
