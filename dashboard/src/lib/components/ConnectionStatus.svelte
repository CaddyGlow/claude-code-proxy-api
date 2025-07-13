<script lang="ts">
interface Props {
	connected: boolean;
	connectionText?: string;
	class?: string;
}

const {
	connected = false,
	connectionText,
	class: additionalClass = "",
}: Props = $props();

// Derived connection status text
const statusText = $derived(
	connectionText || (connected ? "Connected" : "Disconnected"),
);

const dotColorClass = $derived(connected ? "bg-green-500" : "bg-red-500");

const textColorClass = $derived(connected ? "text-gray-600" : "text-red-600");
</script>

<div
	class="connection-status flex items-center space-x-2 {additionalClass}"
	role="status"
	aria-live="polite"
	aria-label="Connection status: {statusText}"
>
	<div
		class="pulse-dot relative {dotColorClass}"
		aria-hidden="true"
		title="{connected ? 'Connected' : 'Disconnected'}"
	></div>
	<span class="text-sm {textColorClass}">
		{statusText}
	</span>
</div>

<style>
	.pulse-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		position: relative;
	}

	.pulse-dot.bg-green-500 {
		background-color: #10b981;
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	.pulse-dot.bg-green-500::before {
		content: "";
		position: absolute;
		width: 0.5rem;
		height: 0.5rem;
		background-color: #10b981;
		border-radius: 50%;
		animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
	}

	.pulse-dot.bg-red-500 {
		background-color: #ef4444;
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	@keyframes ping {
		0% {
			transform: scale(1);
			opacity: 1;
		}
		75%, 100% {
			transform: scale(2);
			opacity: 0;
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.pulse-dot,
		.pulse-dot::before {
			animation: none;
		}
	}
</style>
