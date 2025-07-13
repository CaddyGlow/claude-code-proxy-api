<script lang="ts">
import { onMount } from "svelte";
import { Chart } from "chart.js";
import {
	ArcElement,
	BarController,
	BarElement,
	CategoryScale,
	DoughnutController,
	Filler,
	Legend,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	TimeScale,
	Title,
	Tooltip,
} from "chart.js";
import "chartjs-adapter-date-fns";
import type { ChartConfiguration, ChartOptions, ChartData } from "chart.js";

// Register Chart.js components
Chart.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	Title,
	Tooltip,
	Legend,
	TimeScale,
	Filler,
	LineController,
	BarController,
	DoughnutController,
);

interface Props {
	data: any;
	type: "line" | "bar" | "doughnut" | "pie";
	options?: any;
	class?: string;
	width?: number;
	height?: number;
}

const {
	data,
	type,
	options = {},
	class: className = "",
	width,
	height,
}: Props = $props();

let canvas: HTMLCanvasElement;
let chart: Chart | null = $state(null);

// Create chart configuration
$effect(() => {
	if (!canvas || !data) return;

	const config: any = {
		type,
		data,
		options: {
			maintainAspectRatio: false,
			responsive: true,
			...options,
		},
	};

	// Destroy existing chart if it exists
	if (chart) {
		chart.destroy();
	}

	// Create new chart
	chart = new Chart(canvas, config);

	// Cleanup function
	return () => {
		if (chart) {
			chart.destroy();
			chart = null;
		}
	};
});

// Update chart data reactively
$effect(() => {
	if (chart && data) {
		chart.data = data;
		chart.update("none"); // Update without animation for better performance
	}
});

// Update chart options reactively
$effect(() => {
	if (chart && options) {
		chart.options = {
			maintainAspectRatio: false,
			responsive: true,
			...options,
		};
		chart.update("none");
	}
});
</script>

<div class="chart-container {className}" style:width={width ? `${width}px` : undefined} style:height={height ? `${height}px` : undefined}>
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.chart-container {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 300px;
	}

	canvas {
		width: 100% !important;
		height: 100% !important;
	}
</style>
