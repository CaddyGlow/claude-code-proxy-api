<script lang="ts">
import type { ErrorState, ErrorRetryCallback } from "../types.js";

interface Props {
	error: ErrorState;
	onRetry?: ErrorRetryCallback;
	class?: string;
	showDetails?: boolean;
}

const {
	error,
	onRetry,
	class: additionalClass = "",
	showDetails = false,
}: Props = $props();

// Derived state
const hasError = $derived(error.hasError);
const message = $derived(error.message || "An unexpected error occurred");
const details = $derived(error.details);

// Local state for details visibility
let showDetailsState = $state(false);

const handleRetry = () => {
	if (onRetry) {
		onRetry();
	}
};

const toggleDetails = () => {
	showDetailsState = !showDetailsState;
};

// Auto-focus error message for accessibility
let errorElement = $state<HTMLDivElement | undefined>();

$effect(() => {
	if (hasError && errorElement) {
		errorElement.focus();
	}
});
</script>

{#if hasError}
	<div
		bind:this={errorElement}
		class="error-boundary {additionalClass}"
		role="alert"
		aria-live="assertive"
		aria-labelledby="error-title"
		aria-describedby="error-message"
		tabindex="-1"
	>
		<div class="error-content">
			<!-- Error Icon -->
			<div class="error-icon" aria-hidden="true">
				<svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
					/>
				</svg>
			</div>

			<!-- Error Title -->
			<h3 id="error-title" class="error-title">Something went wrong</h3>

			<!-- Error Message -->
			<p id="error-message" class="error-message">{message}</p>

			<!-- Action Buttons -->
			<div class="error-actions">
				{#if onRetry}
					<button
						onclick={handleRetry}
						class="retry-button"
						type="button"
						aria-label="Retry the failed operation"
					>
						<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
						</svg>
						Try Again
					</button>
				{/if}

				{#if details && showDetails}
					<button
						onclick={toggleDetails}
						class="details-button"
						type="button"
						aria-expanded={showDetailsState}
						aria-controls="error-details"
					>
						{showDetailsState ? 'Hide Details' : 'Show Details'}
					</button>
				{/if}
			</div>

			<!-- Error Details (collapsible) -->
			{#if details && showDetails && showDetailsState}
				<div
					id="error-details"
					class="error-details"
					role="region"
					aria-label="Error details"
				>
					<h4 class="details-title">Error Details:</h4>
					<pre class="details-content">{details}</pre>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.error-boundary {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.error-content {
		text-align: center;
		max-width: 28rem;
		margin: 0 auto;
	}

	.error-icon {
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
	}

	.error-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: #111827;
		margin-bottom: 0.5rem;
	}

	.error-message {
		color: #4b5563;
		margin-bottom: 1.5rem;
	}

	.error-actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		justify-content: center;
		align-items: center;
		margin-bottom: 1rem;
	}

	@media (min-width: 640px) {
		.error-actions {
			flex-direction: row;
		}
	}

	.retry-button {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 1rem;
		background-color: var(--claude-600);
		color: white;
		font-weight: 500;
		border-radius: 0.375rem;
		border: none;
		cursor: pointer;
		transition: background-color 200ms;
	}

	.retry-button:hover {
		background-color: var(--claude-700);
	}

	.retry-button:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--claude-500), 0 0 0 4px rgba(237, 121, 67, 0.2);
	}

	.details-button {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.75rem;
		font-size: 0.875rem;
		color: #6b7280;
		background: none;
		border: none;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: color 200ms;
	}

	.details-button:hover {
		color: #374151;
	}

	.details-button:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--claude-500), 0 0 0 4px rgba(237, 121, 67, 0.2);
	}

	.error-details {
		margin-top: 1rem;
		padding: 1rem;
		background-color: #f9fafb;
		border-radius: 0.375rem;
		text-align: left;
	}

	.details-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: #111827;
		margin-bottom: 0.5rem;
	}

	.details-content {
		font-size: 0.75rem;
		color: #374151;
		white-space: pre-wrap;
		word-break: break-words;
		max-height: 8rem;
		overflow-y: auto;
		background-color: white;
		padding: 0.5rem;
		border-radius: 0.25rem;
		border: 1px solid #e5e7eb;
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.error-boundary {
			border: 1px solid #ef4444;
		}

		.retry-button {
			border: 2px solid white;
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.retry-button,
		.details-button {
			transition: none;
		}
	}
</style>
