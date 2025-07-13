<script lang="ts">
import type { LoadingState } from "../types.js";

interface Props {
	loading: LoadingState;
	class?: string;
}

const { loading, class: additionalClass = "" }: Props = $props();

// Derived state for visibility
const isVisible = $derived(loading.isLoading);
const message = $derived(loading.message || "Loading dashboard...");

// Focus management for accessibility
let overlayElement = $state<HTMLDivElement | undefined>();

$effect(() => {
	if (isVisible && overlayElement) {
		// Focus the overlay when it becomes visible
		overlayElement.focus();
		// Prevent body scroll
		document.body.style.overflow = "hidden";
	} else {
		// Restore body scroll
		document.body.style.overflow = "";
	}

	return () => {
		// Cleanup on unmount
		document.body.style.overflow = "";
	};
});
</script>

{#if isVisible}
	<div
		bind:this={overlayElement}
		class="loading-overlay {additionalClass}"
		role="dialog"
		aria-modal="true"
		aria-labelledby="loading-title"
		aria-describedby="loading-message"
		tabindex="-1"
	>
		<div class="loading-content">
			<div
				class="spinner"
				role="status"
				aria-label="Loading"
				aria-hidden="false"
			></div>
			<p id="loading-title" class="sr-only">Loading</p>
			<p id="loading-message" class="loading-message">{message}</p>
		</div>
	</div>
{/if}

<style>
	.loading-overlay {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		background-color: rgba(17, 24, 39, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		backdrop-filter: blur(2px);
	}

	.loading-content {
		background-color: white;
		border-radius: 0.5rem;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		max-width: 24rem;
		margin: 0 1rem;
		animation: fadeInScale 0.2s ease-out;
	}

	.loading-message {
		color: #4b5563;
		text-align: center;
	}

	.spinner {
		display: inline-block;
		width: 2rem;
		height: 2rem;
		border: 4px solid #e5e7eb;
		border-top-color: var(--claude-600);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes fadeInScale {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Ensure high contrast for loading spinner */
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}

		.loading-content {
			animation: none;
		}

		/* Show a static indicator for reduced motion users */
		.spinner::after {
			content: "⏳";
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			font-size: 1.5rem;
		}
	}
</style>
