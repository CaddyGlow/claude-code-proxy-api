# Metrics API TypeScript Documentation

## Base URL
```
http://localhost:8000/metrics
```

## Endpoints

### 1. Get Analytics Data
**GET** `/analytics`

Get comprehensive analytics for metrics data with summary statistics, hourly trends, and model/service breakdowns.

#### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_time` | `number` | No | Start timestamp (Unix time) |
| `end_time` | `number` | No | End timestamp (Unix time) |
| `model` | `string` | No | Filter by model name |
| `service_type` | `string` | No | Filter by service type (`proxy_service` or `claude_sdk_service`) |
| `hours` | `number` | No | Hours of data to analyze (default: 24, min: 1, max: 168) |

#### Response Type
```typescript
interface AnalyticsResponse {
  summary: {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    avg_response_time: number;
    median_response_time: number;
    p95_response_time: number;
    total_tokens_input: number;
    total_tokens_output: number;
    total_cost_usd: number;
  };
  hourly_data: Array<{
    hour: string; // ISO datetime string
    request_count: number;
    error_count: number;
  }>;
  model_stats: Array<{
    model: string;
    request_count: number;
    avg_response_time: number;
    total_cost: number;
  }>;
  service_breakdown: Array<{
    service_type: string; // "proxy_service" | "claude_sdk_service" | "unknown"
    request_count: number;
    avg_response_time: number;
    median_response_time: number;
    p95_response_time: number;
    total_cost: number;
  }>;
  query_time: number;
  query_params: {
    start_time: number | null;
    end_time: number | null;
    model: string | null;
    service_type: string | null;
    hours: number | null;
  };
}
```

#### Example Request
```typescript
// Get all analytics for the last 24 hours
const response = await fetch('/metrics/analytics?hours=24');
const data: AnalyticsResponse = await response.json();

// Get analytics filtered by proxy service only
const proxyResponse = await fetch('/metrics/analytics?service_type=proxy_service&hours=12');
const proxyData: AnalyticsResponse = await proxyResponse.json();
```

### 2. Stream Real-time Metrics
**GET** `/stream`

Server-Sent Events stream for real-time metrics and request logs.

#### Response Type
The SSE stream sends JSON events with different event types:

```typescript
type MetricsStreamEvent =
  | ConnectionEvent
  | AnalyticsUpdateEvent
  | HeartbeatEvent
  | ErrorEvent
  | DisconnectEvent;

interface BaseEvent {
  timestamp: number;
}

interface ConnectionEvent extends BaseEvent {
  type: 'connection';
  message: string;
}

interface AnalyticsUpdateEvent extends BaseEvent {
  type: 'analytics_update';
  data: AnalyticsResponse;
}

interface HeartbeatEvent extends BaseEvent {
  type: 'heartbeat';
  stats: {
    total_requests: number;
    timestamp: number;
  };
}

interface ErrorEvent extends BaseEvent {
  type: 'error';
  message: string;
}

interface DisconnectEvent extends BaseEvent {
  type: 'disconnect';
  message: string;
}
```

#### Example Usage
```typescript
// Connect to metrics stream
const eventSource = new EventSource('/metrics/stream');

eventSource.onmessage = (event) => {
  const data: MetricsStreamEvent = JSON.parse(event.data);

  switch (data.type) {
    case 'connection':
      console.log('Connected to metrics stream:', data.message);
      break;

    case 'analytics_update':
      console.log('New request detected! Updated analytics:', data.data);
      updateDashboard(data.data);
      break;

    case 'heartbeat':
      console.log('Current request count:', data.stats.total_requests);
      break;

    case 'error':
      console.error('Stream error:', data.message);
      break;

    case 'disconnect':
      console.log('Stream disconnected:', data.message);
      break;
  }
};

eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
};

// Close connection when done
eventSource.close();
```

### 3. Get Storage Health
**GET** `/health`

Get health status of the storage backend.

#### Response Type
```typescript
interface StorageHealthResponse {
  status: 'healthy' | 'unhealthy' | 'unavailable' | 'not_initialized' | 'connection_failed';
  storage_backend: string;
  enabled: boolean;
  database_path?: string;
  request_count?: number;
  pool_size?: number;
  error?: string;
  reason?: string;
}
```

#### Example Request
```typescript
const response = await fetch('/metrics/health');
const health: StorageHealthResponse = await response.json();

if (health.status === 'healthy') {
  console.log(`Storage is healthy with ${health.request_count} requests`);
} else {
  console.error(`Storage issue: ${health.status} - ${health.error || health.reason}`);
}
```

### 4. Get Metrics Status
**GET** `/status`

Get observability system status.

#### Response Type
```typescript
interface MetricsStatusResponse {
  status: 'healthy';
  prometheus_enabled: string; // "true" | "false"
  observability_system: string;
}
```

#### Example Request
```typescript
const response = await fetch('/metrics/status');
const status: MetricsStatusResponse = await response.json();
```

### 5. Custom SQL Query
**POST** `/query`

Execute custom SQL queries against the metrics database.

#### Request Type
```typescript
interface QueryRequest {
  sql: string;
  params?: Array<string | number>;
  limit?: number; // Default: 1000
}
```

#### Response Type
```typescript
interface QueryResponse {
  results: Array<Record<string, any>>;
  query_time: number;
  row_count: number;
}
```

#### Example Request
```typescript
const queryRequest: QueryRequest = {
  sql: "SELECT service_type, COUNT(*) as count FROM requests WHERE timestamp > ? GROUP BY service_type",
  params: [Date.now() / 1000 - 3600], // Last hour
  limit: 100
};

const response = await fetch('/metrics/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(queryRequest)
});

const data: QueryResponse = await response.json();
```

## Service Types

The analytics distinguish between different service types:

```typescript
type ServiceType = 'proxy_service' | 'claude_sdk_service' | 'unknown';
```

- **`proxy_service`**: Requests handled by the proxy service (routes: `/api/*`)
- **`claude_sdk_service`**: Requests handled directly by Claude SDK (routes: `/sdk/*`)
- **`unknown`**: Legacy requests without service type information

## Error Handling

All endpoints may return HTTP error responses:

```typescript
interface ErrorResponse {
  detail: string;
}

// Example error handling
try {
  const response = await fetch('/metrics/analytics');
  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(`API Error: ${error.detail}`);
  }
  const data: AnalyticsResponse = await response.json();
} catch (error) {
  console.error('Failed to fetch analytics:', error);
}
```

## Common HTTP Status Codes

- **200**: Success
- **400**: Bad Request (invalid parameters)
- **500**: Internal Server Error
- **503**: Service Unavailable (storage backend not available)

## Notes

- All timestamps are Unix timestamps (seconds since epoch)
- Response times are in seconds
- Costs are in USD
- Token counts are integers
- The SSE stream sends data every 2 seconds and detects new requests automatically
- Analytics data is stored in DuckDB and processed through the observability pipeline

## React Hook Example

Here's a React hook for consuming the metrics stream:

```typescript
import { useEffect, useState } from 'react';

interface UseMetricsStreamOptions {
  baseUrl?: string;
  onAnalyticsUpdate?: (data: AnalyticsResponse) => void;
  onError?: (error: string) => void;
}

export function useMetricsStream(options: UseMetricsStreamOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [currentStats, setCurrentStats] = useState<{ total_requests: number } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<AnalyticsResponse | null>(null);

  useEffect(() => {
    const baseUrl = options.baseUrl || '';
    const eventSource = new EventSource(`${baseUrl}/metrics/stream`);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: MetricsStreamEvent = JSON.parse(event.data);

        switch (data.type) {
          case 'connection':
            console.log('Connected to metrics stream');
            break;

          case 'analytics_update':
            setLastUpdate(data.data);
            options.onAnalyticsUpdate?.(data.data);
            break;

          case 'heartbeat':
            setCurrentStats(data.stats);
            break;

          case 'error':
            options.onError?.(data.message);
            break;

          case 'disconnect':
            setIsConnected(false);
            break;
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      options.onError?.('SSE connection error');
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [options.baseUrl]);

  return {
    isConnected,
    currentStats,
    lastUpdate,
  };
}

// Usage in component
function MetricsDashboard() {
  const { isConnected, currentStats, lastUpdate } = useMetricsStream({
    onAnalyticsUpdate: (data) => {
      console.log('New analytics data:', data);
    },
    onError: (error) => {
      console.error('Metrics stream error:', error);
    },
  });

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      {currentStats && <div>Total Requests: {currentStats.total_requests}</div>}
      {lastUpdate && (
        <div>
          <h3>Service Breakdown:</h3>
          {lastUpdate.service_breakdown.map(service => (
            <div key={service.service_type}>
              {service.service_type}: {service.request_count} requests
              (avg {service.avg_response_time.toFixed(3)}s)
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```
