<script lang="ts">
import ChartContainer from "./ChartContainer.svelte";
import type { ChartData, ChartOptions } from "chart.js";
import type { RequestMetric, AnyMetric } from "$lib/types/metrics";
import { DASHBOARD_CONFIG } from "$lib/utils/constants";
import { formatNumber } from "$lib/utils/formatters";

interface Props {
	metrics: RequestMetric[];
	class?: string;
}

const { metrics, class: className = "" }: Props = $props();

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
	if (!metrics || metrics.length === 0) {
		return {
			labels: [],
			datasets: [
				{
					label: "Requests",
					data: [],
					borderColor: DASHBOARD_CONFIG.COLORS.primary,
					backgroundColor: DASHBOARD_CONFIG.COLORS.primary + "20",
					fill: true,
					tension: 0.4,
				},
			],
		};
	}

	// Group metrics by time interval
	const timeGroups = groupMetricsByTime(metrics, "hour");
	const labels = Object.keys(timeGroups).sort();
	const data = labels.map((label) => timeGroups[label]?.length ?? 0);

	return {
		labels,
		datasets: [
			{
				label: "Requests",
				data,
				borderColor: DASHBOARD_CONFIG.COLORS.primary,
				backgroundColor: DASHBOARD_CONFIG.COLORS.primary + "20",
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
				label: (context) => `Requests: ${formatNumber(context.parsed.y)}`,
			},
		},
	},
	scales: {
		x: {
			type: "time",
			time: {
				displayFormats: {
					hour: "HH:mm",
					day: "MMM dd",
				},
			},
			...DASHBOARD_CONFIG.CHART_DEFAULTS.scales!.x,
		},
		y: {
			...DASHBOARD_CONFIG.CHART_DEFAULTS.scales!.y,
			beginAtZero: true,
			ticks: {
				callback: (value) => formatNumber(Number(value)),
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
