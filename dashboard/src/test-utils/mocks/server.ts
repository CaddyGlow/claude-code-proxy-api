import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type {
  AnalyticsResponse,
  MetricsStatusResponse,
  QueryResponse,
  StorageHealthResponse,
} from "$lib/types/metrics";

const mockAnalyticsResponse: AnalyticsResponse = {
  summary: {
    total_requests: 1250,
    successful_requests: 1230,
    success_rate: 98.4,
    avg_response_time: 245,
    total_cost: 15.75,
    total_cost_usd: 15.75,
    error_count: 20,
    unique_models: 3,
    total_tokens_input: 125000,
    total_tokens_output: 87500,
  },
  time_series: [
    {
      timestamp: "2024-01-15T10:00:00Z",
      requests: 45,
      success_rate: 97.8,
      avg_response_time: 235,
      cost: 0.85,
      errors: 1,
    },
    {
      timestamp: "2024-01-15T11:00:00Z",
      requests: 52,
      success_rate: 98.1,
      avg_response_time: 255,
      cost: 1.1,
      errors: 1,
    },
  ],
  models: [
    {
      model: "claude-3-sonnet",
      requests: 800,
      success_rate: 98.5,
      avg_response_time: 240,
      cost: 12.5,
      errors: 12,
    },
    {
      model: "claude-3-haiku",
      requests: 450,
      success_rate: 98.2,
      avg_response_time: 250,
      cost: 3.25,
      errors: 8,
    },
  ],
  service_types: [
    {
      service_type: "anthropic",
      requests: 950,
      success_rate: 98.6,
      avg_response_time: 242,
      cost: 13.5,
      errors: 13,
    },
    {
      service_type: "openai",
      requests: 300,
      success_rate: 97.7,
      avg_response_time: 252,
      cost: 2.25,
      errors: 7,
    },
  ],
  errors: [
    {
      error_type: "rate_limit",
      count: 8,
      percentage: 40.0,
    },
    {
      error_type: "timeout",
      count: 7,
      percentage: 35.0,
    },
    {
      error_type: "validation",
      count: 5,
      percentage: 25.0,
    },
  ],
  hourly_data: [
    {
      hour: "2024-01-15T08:00:00Z",
      request_count: 42,
    },
    {
      hour: "2024-01-15T09:00:00Z",
      request_count: 48,
    },
    {
      hour: "2024-01-15T10:00:00Z",
      request_count: 45,
    },
    {
      hour: "2024-01-15T11:00:00Z",
      request_count: 52,
    },
  ],
  model_stats: [
    {
      model: "claude-3-sonnet",
      request_count: 800,
      avg_response_time: 240,
      total_cost: 12.5,
    },
    {
      model: "claude-3-haiku",
      request_count: 450,
      avg_response_time: 250,
      total_cost: 3.25,
    },
  ],
  service_breakdown: [
    {
      service_type: "anthropic",
      request_count: 950,
    },
    {
      service_type: "openai",
      request_count: 300,
    },
  ],
};

const mockHealthResponse: StorageHealthResponse = {
  status: "healthy",
  database_size: "2.45 MB",
  total_records: 15420,
  last_cleanup: "2024-01-15T08:30:00Z",
  retention_days: 30,
};

const mockStatusResponse: MetricsStatusResponse = {
  status: "healthy",
  uptime: 432000,
  version: "0.1.0",
  storage_backend: "duckdb",
};

const mockQueryResponse: QueryResponse = {
  columns: ["timestamp", "model", "requests"],
  data: [
    ["2024-01-15T10:00:00Z", "claude-3-sonnet", 45],
    ["2024-01-15T11:00:00Z", "claude-3-sonnet", 52],
  ],
  row_count: 2,
  execution_time: 0.025,
};

export const handlers = [
  http.get("/metrics/analytics", () => {
    return HttpResponse.json(mockAnalyticsResponse);
  }),

  http.get("/metrics/health", () => {
    return HttpResponse.json(mockHealthResponse);
  }),

  http.get("/metrics/status", () => {
    return HttpResponse.json(mockStatusResponse);
  }),

  http.post("/metrics/query", () => {
    return HttpResponse.json(mockQueryResponse);
  }),

  // Error scenarios for testing
  http.get("/metrics/analytics/error", () => {
    return HttpResponse.json({ detail: "Internal server error" }, { status: 500 });
  }),

  http.get("/metrics/analytics/network-error", () => {
    return HttpResponse.error();
  }),
];

export const server = setupServer(...handlers);
