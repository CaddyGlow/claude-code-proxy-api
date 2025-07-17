import type { ApiMetricType } from "../types/metrics";

// Dashboard configuration constants
export const DASHBOARD_CONFIG = {
  // API endpoints
  API_BASE: "/metrics",
  ENDPOINTS: {
    STATUS: "/status",
    DATA: "/data",
    SUMMARY: "/summary",
    STREAM: "/stream",
    HEALTH: "/health",
    SSE_CONNECTIONS: "/sse/connections",
  },

  // Time ranges
  TIME_RANGES: {
    "1h": { hours: 1, label: "Last Hour" },
    "6h": { hours: 6, label: "Last 6 Hours" },
    "24h": { hours: 24, label: "Last 24 Hours" },
    "7d": { days: 7, label: "Last 7 Days" },
  } as const,

  // Chart colors
  COLORS: {
    primary: "#d97706",
    secondary: "#0ea5e9",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#6366f1",
    gray: "#6b7280",

    // Chart color palette
    chart: [
      "#d97706",
      "#0ea5e9",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#6366f1",
      "#8b5cf6",
      "#06b6d4",
      "#84cc16",
      "#f97316",
      "#ec4899",
      "#14b8a6",
    ],
  },

  // Chart defaults
  CHART_DEFAULTS: {
    maintainAspectRatio: false,
    responsive: true,
    interaction: {
      intersect: false,
      mode: "index" as const,
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.9)",
        titleColor: "#f9fafb",
        bodyColor: "#f9fafb",
        borderColor: "#374151",
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
      },
      y: {
        grid: {
          color: "rgba(156, 163, 175, 0.2)",
        },
        border: {
          display: false,
        },
      },
    },
    elements: {
      line: {
        tension: 0.4,
      },
      point: {
        radius: 0,
        hoverRadius: 6,
      },
    },
  },

  // Update intervals
  INTERVALS: {
    SUMMARY_UPDATE: 30000, // 30 seconds
    CHART_UPDATE: 60000, // 1 minute
    HEALTH_CHECK: 60000, // 1 minute
    ACTIVITY_CLEANUP: 300000, // 5 minutes
  },

  // Limits
  LIMITS: {
    MAX_ACTIVITY_ITEMS: 50,
    MAX_CHART_POINTS: 100,
    PAGE_SIZE: 1000,
  },
} as const;

// Metric type definitions
export const METRIC_TYPES: Record<string, ApiMetricType> = {
  REQUEST: "total_requests",
  RESPONSE: "successful_requests",
  ERROR: "failed_requests",
  COST: "avg_response_time",
} as const;

// Error type mappings for better display
export const ERROR_TYPE_LABELS: Record<string, string> = {
  rate_limit_exceeded: "Rate Limit",
  authentication_failed: "Auth Failed",
  internal_server_error: "Server Error",
  timeout: "Timeout",
  network_error: "Network Error",
  validation_error: "Validation Error",
} as const;

// Model name mappings for cleaner display
export const MODEL_LABELS: Record<string, string> = {
  "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
  "claude-3-haiku-20240307": "Claude 3 Haiku",
  "claude-3-opus-20240229": "Claude 3 Opus",
} as const;

// Time range type
export type TimeRange = keyof typeof DASHBOARD_CONFIG.TIME_RANGES;
