<script lang="ts">
import type { EntriesResponse } from "$lib/types/metrics";
import { metricsApi } from "$lib/services/metrics-api";
import { onMount } from "svelte";

// Modern Svelte 5 reactive state
let entriesData = $state<EntriesResponse | null>(null);
let _isLoading = $state(true);
let _error = $state<string | null>(null);

// Pagination and sorting state
let currentPage = $state(1);
let pageSize = $state(50);
let orderBy = $state("timestamp");
let orderDesc = $state(true);
let serviceTypeFilter = $state("!access_log"); // Default: exclude access_log

// Derived computed values
const _entries = $derived(entriesData?.entries || []);
const _totalPages = $derived(entriesData?.total_pages || 0);
const _totalCount = $derived(entriesData?.total_count || 0);

// Load entries data
async function loadEntries() {
	try {
		_isLoading = true;
		_error = null;

		const params = {
			limit: pageSize,
			offset: (currentPage - 1) * pageSize,
			order_by: orderBy,
			order_desc: orderDesc,
			service_type: serviceTypeFilter,
		};

		entriesData = await metricsApi.getEntries(params);
	} catch (error) {
		_error = error instanceof Error ? error.message : "Failed to load entries";
		if (import.meta.env.DEV) {
			console.error("Failed to load entries:", error);
		}
	} finally {
		_isLoading = false;
	}
}

// Pagination handlers
function _goToPage(page: number) {
	currentPage = page;
	loadEntries();
}

function _nextPage() {
	if (currentPage < _totalPages) {
		currentPage++;
		loadEntries();
	}
}

function _prevPage() {
	if (currentPage > 1) {
		currentPage--;
		loadEntries();
	}
}

// Sorting handlers
function _changeSorting(column: string) {
	if (orderBy === column) {
		orderDesc = !orderDesc;
	} else {
		orderBy = column;
		orderDesc = true;
	}
	currentPage = 1; // Reset to first page when sorting changes
	loadEntries();
}

// Format functions
function _formatTimestamp(timestamp: string): string {
	return new Date(timestamp).toLocaleString();
}

function _formatCost(cost_usd: number | null): string {
	if (cost_usd === null || cost_usd === undefined) {
		return "$0.0000";
	}
	return `$${cost_usd.toFixed(4)}`;
}

function _formatDuration(durationMs: number): string {
	if (durationMs === null || durationMs === undefined) {
		return "0ms";
	}
	if (durationMs < 1000) {
		return `${durationMs.toFixed(0)}ms`;
	}
	return `${(durationMs / 1000).toFixed(2)}s`;
}

function _formatTokens(input: number, output: number): string {
	const inputTokens = input || 0;
	const outputTokens = output || 0;
	const total = inputTokens + outputTokens;
	return `${total.toLocaleString()} (${inputTokens.toLocaleString()}/${outputTokens.toLocaleString()})`;
}

function _formatStatusCode(statusCode: number): {
	text: string;
	color: string;
} {
	if (statusCode >= 200 && statusCode < 300) {
		return { text: `${statusCode} Success`, color: "green" };
	}
	if (statusCode >= 400 && statusCode < 500) {
		return { text: `${statusCode} Client Error`, color: "red" };
	}
	if (statusCode >= 500) {
		return { text: `${statusCode} Server Error`, color: "red" };
	}
	return { text: `${statusCode}`, color: "gray" };
}

// Initialize on mount
onMount(() => {
	loadEntries();
});
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="bg-white shadow-sm border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center h-16">
				<div class="flex items-center space-x-3">
					<a href="/metrics/dashboard" class="text-blue-600 hover:text-blue-800" aria-label="Back to dashboard">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
						</svg>
					</a>
					<div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
						<svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
							<path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
						</svg>
					</div>
					<div>
						<h1 class="text-xl font-bold text-gray-900">Database Entries</h1>
						<p class="text-sm text-gray-500">Last {_totalCount} request entries</p>
					</div>
				</div>

				<!-- Controls -->
				<div class="flex items-center space-x-4">
					<select
						value={serviceTypeFilter}
						onchange={(e) => {
							serviceTypeFilter = e.currentTarget.value;
							currentPage = 1;
							loadEntries();
						}}
						class="text-sm border border-gray-300 rounded px-2 py-1"
					>
						<option value="">All Services</option>
						<option value="!access_log">Exclude Access Logs</option>
						<option value="proxy_service">Proxy Service Only</option>
						<option value="claude_sdk_service">Claude SDK Only</option>
						<option value="proxy_service,claude_sdk_service">API Services Only</option>
					</select>

					<select
						value={pageSize}
						onchange={(e) => {
							pageSize = Number(e.currentTarget.value);
							currentPage = 1;
							loadEntries();
						}}
						class="text-sm border border-gray-300 rounded px-2 py-1"
					>
						<option value={25}>25 per page</option>
						<option value={50}>50 per page</option>
						<option value={100}>100 per page</option>
					</select>

					<button
						onclick={loadEntries}
						class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
					>
						Refresh
					</button>
				</div>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{#if _error}
			<div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
						</svg>
					</div>
					<div class="ml-3">
						<h3 class="text-sm font-medium text-red-800">Error loading entries</h3>
						<div class="mt-2 text-sm text-red-700">
							<p>{_error}</p>
						</div>
					</div>
				</div>
			</div>
		{:else if _isLoading}
			<div class="flex items-center justify-center py-12">
				<div class="flex items-center space-x-2">
					<div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
					<span class="text-gray-600">Loading entries...</span>
				</div>
			</div>
		{:else if _entries.length === 0}
			<div class="text-center py-12">
				<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
				</svg>
				<h3 class="mt-2 text-sm font-medium text-gray-900">No entries found</h3>
				<p class="mt-1 text-sm text-gray-500">No database entries are available at this time.</p>
			</div>
		{:else}
			<!-- Entries Table -->
			<div class="bg-white shadow overflow-hidden sm:rounded-md">
				<div class="px-4 py-5 sm:px-6">
					<h3 class="text-lg leading-6 font-medium text-gray-900">Request Entries</h3>
					<p class="mt-1 max-w-2xl text-sm text-gray-500">
						Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, _totalCount)} of {_totalCount} entries
					</p>
				</div>

				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									<button
										onclick={() => changeSorting("timestamp")}
										class="group flex items-center space-x-1 hover:text-gray-700"
									>
										<span>Timestamp</span>
										{#if orderBy === "timestamp"}
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												{#if orderDesc}
													<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
												{:else}
													<path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
												{/if}
											</svg>
										{/if}
									</button>
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									<button
										onclick={() => changeSorting("model")}
										class="group flex items-center space-x-1 hover:text-gray-700"
									>
										<span>Model</span>
										{#if orderBy === "model"}
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												{#if orderDesc}
													<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
												{:else}
													<path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
												{/if}
											</svg>
										{/if}
									</button>
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Service
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									<button
										onclick={() => changeSorting("duration_ms")}
										class="group flex items-center space-x-1 hover:text-gray-700"
									>
										<span>Duration</span>
										{#if orderBy === "duration_ms"}
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												{#if orderDesc}
													<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
												{:else}
													<path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
												{/if}
											</svg>
										{/if}
									</button>
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									<button
										onclick={() => changeSorting("status_code")}
										class="group flex items-center space-x-1 hover:text-gray-700"
									>
										<span>Status</span>
										{#if orderBy === "status_code"}
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												{#if orderDesc}
													<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
												{:else}
													<path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
												{/if}
											</svg>
										{/if}
									</button>
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									<button
										onclick={() => changeSorting("cost_usd")}
										class="group flex items-center space-x-1 hover:text-gray-700"
									>
										<span>Cost</span>
										{#if orderBy === "cost_usd"}
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												{#if orderDesc}
													<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
												{:else}
													<path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
												{/if}
											</svg>
										{/if}
									</button>
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Tokens (Total/In/Out)
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Request ID
								</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each _entries as entry (entry.request_id)}
								{@const statusInfo = formatStatusCode(entry.status_code)}
								<tr class="hover:bg-gray-50">
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{formatTimestamp(entry.timestamp)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
											{entry.model}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										<span class="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
											{entry.service_type}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{formatDuration(entry.duration_ms)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										{#if statusInfo.color === "green"}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
												<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
													<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
												</svg>
												{statusInfo.text}
											</span>
										{:else if statusInfo.color === "red"}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
												<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
													<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
												</svg>
												{statusInfo.text}
											</span>
										{:else}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
												{statusInfo.text}
											</span>
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{formatCost(entry.cost_usd)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{formatTokens(entry.tokens_input, entry.tokens_output)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
										{entry.request_id}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				{#if _totalPages > 1}
					<div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
						<div class="flex-1 flex justify-between sm:hidden">
							<button
								onclick={prevPage}
								disabled={currentPage === 1}
								class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Previous
							</button>
							<button
								onclick={nextPage}
								disabled={currentPage === _totalPages}
								class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Next
							</button>
						</div>
						<div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
							<div>
								<p class="text-sm text-gray-700">
									Showing
									<span class="font-medium">{((currentPage - 1) * pageSize) + 1}</span>
									to
									<span class="font-medium">{Math.min(currentPage * pageSize, _totalCount)}</span>
									of
									<span class="font-medium">{_totalCount}</span>
									results
								</p>
							</div>
							<div>
								<nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
									<button
										onclick={prevPage}
										disabled={currentPage === 1}
										class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<span class="sr-only">Previous</span>
										<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
										</svg>
									</button>

									{#each Array.from({length: Math.min(5, _totalPages)}, (_, i) => i + Math.max(1, currentPage - 2)) as page}
										{#if page <= _totalPages}
											<button
												onclick={() => goToPage(page)}
												class="relative inline-flex items-center px-4 py-2 border text-sm font-medium {page === currentPage ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}"
											>
												{page}
											</button>
										{/if}
									{/each}

									<button
										onclick={nextPage}
										disabled={currentPage === _totalPages}
										class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<span class="sr-only">Next</span>
										<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
										</svg>
									</button>
								</nav>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</main>
</div>
