<script lang="ts">
import ChartContainer from "./ChartContainer.svelte";
import type { ChartData, ChartOptions } from "chart.js";
import type { MetricsSummary } from "$lib/types/metrics";
import { DASHBOARD_CONFIG } from "$lib/utils/constants";
import { formatDuration } from "$lib/utils/formatters";

interface Props {
	summaries: Array<{ timestamp: string; summary: MetricsSummary }>;
	class?: string;
}

const { summaries, class: className = "" }: Props = $props();

// Prepare chart data
const chartData = $derived(() => {
	if (!summaries || summaries.length === 0) {
		return {
			labels: [],
			datasets: [
				{
					label: "Average",
					data: [],
					borderColor: DASHBOARD_CONFIG.COLORS.secondary,
					backgroundColor: "transparent",
					tension: 0.4,
				},
				{
					label: "P95",
					data: [],
					borderColor: DASHBOARD_CONFIG.COLORS.warning,
					backgroundColor: "transparent",
					tension: 0.4,
				},
				{
					label: "P99",
					data: [],
					borderColor: DASHBOARD_CONFIG.COLORS.danger,
					backgroundColor: "transparent",
					tension: 0.4,
				},
			],
		};
	}

	const labels = summaries.map((s) => s.timestamp);
	const avgData = summaries.map(
		(s) =>
			s.summary?.performance?.avg_response_time_ms ??
			s.summary?.response_metrics?.avg_response_time_ms ??
			0,
	);
	const p95Data = summaries.map(
		(s) =>
			s.summary?.performance?.p95_response_time_ms ??
			s.summary?.response_metrics?.p95_response_time_ms ??
			0,
	);
	const p99Data = summaries.map(
		(s) =>
			s.summary?.performance?.p99_response_time_ms ??
			s.summary?.response_metrics?.p99_response_time_ms ??
			0,
	);

	return {
		labels,
		datasets: [
			{
				label: "Average",
				data: avgData,
				borderColor: DASHBOARD_CONFIG.COLORS.secondary,
				backgroundColor: "transparent",
				tension: 0.4,
			},
			{
				label: "P95",
				data: p95Data,
				borderColor: DASHBOARD_CONFIG.COLORS.warning,
				backgroundColor: "transparent",
				tension: 0.4,
			},
			{
				label: "P99",
				data: p99Data,
				borderColor: DASHBOARD_CONFIG.COLORS.danger,
				backgroundColor: "transparent",
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
				label: (context) =>
					`${context.dataset.label}: ${formatDuration(context.parsed.y)}`,
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
				callback: (value) => formatDuration(Number(value)),
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
