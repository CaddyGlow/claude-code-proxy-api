<script lang="ts">
import type {
	TimeRange,
	TimeRangeOption,
	TimeRangeChangeCallback,
} from "../types.js";

interface Props {
	selectedRange: TimeRange;
	options?: TimeRangeOption[];
	disabled?: boolean;
	class?: string;
	onTimeRangeChange: TimeRangeChangeCallback;
}

const {
	selectedRange: initialRange,
	options = [
		{ value: "1h", label: "Last Hour" },
		{ value: "6h", label: "Last 6 Hours" },
		{ value: "24h", label: "Last 24 Hours" },
		{ value: "7d", label: "Last 7 Days" },
	],
	disabled = false,
	class: additionalClass = "",
	onTimeRangeChange,
}: Props = $props();

let selectedRange = $state(initialRange);

// Update local state when prop changes
$effect(() => {
	selectedRange = initialRange;
});

const handleChange = (event: Event) => {
	const target = event.target as HTMLSelectElement;
	const newRange = target.value as TimeRange;
	selectedRange = newRange;
	onTimeRangeChange(newRange);
};
</script>

<div class="time-range-selector {additionalClass}">
	<label for="time-range-select" class="sr-only">Select time range</label>
	<select
		id="time-range-select"
		bind:value={selectedRange}
		onchange={handleChange}
		{disabled}
		class="form-select text-sm border-gray-300 rounded-md focus-claude {disabled ? 'opacity-50 cursor-not-allowed' : ''}"
		aria-label="Time range selection"
	>
		{#each options as option (option.value)}
			<option value={option.value} selected={selectedRange === option.value}>
				{option.label}
			</option>
		{/each}
	</select>
</div>

<style>
	.form-select {
		display: block;
		width: 100%;
		padding: 0.5rem 0.75rem;
		background-color: white;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
		font-size: 0.875rem;
	}

	.form-select:focus {
		outline: none;
		border-color: var(--claude-500);
		box-shadow: 0 0 0 1px var(--claude-500);
	}

	.form-select:disabled {
		background-color: #f3f4f6;
		cursor: not-allowed;
	}
</style>
