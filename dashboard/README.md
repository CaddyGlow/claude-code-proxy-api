# Claude Code Proxy Metrics Dashboard

A lightweight, TypeScript-based metrics dashboard for the Claude Code Proxy API built with Vite, Bun, and Tailwind CSS.

## Features

- **Real-time Metrics**: Live updates via Server-Sent Events (SSE)
- **Interactive Charts**: Request volume, response time, error distribution, model usage, and cost analytics
- **Time Range Selection**: 1h, 6h, 24h, 7d views
- **Activity Feed**: Real-time request activity stream
- **Responsive Design**: Mobile-friendly with Tailwind CSS
- **Type Safe**: Full TypeScript implementation

## Tech Stack

- **Build Tool**: Vite
- **Package Manager**: Bun
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Chart.js
- **Date Handling**: date-fns

## Development

### Prerequisites

- Bun (recommended) or Node.js 18+
- TypeScript 5.x

### Setup

```bash
# Install dependencies
bun install

# Start development server with HMR
bun run dev

# Type checking
bun run type-check
```

### Building

```bash
# Build for production
bun run build

# Build and copy to FastAPI static directory
bun run build:prod

# Watch mode for development
bun run watch
```

## Project Structure

```
dashboard/
├── src/
│   ├── components/         # Core components
│   │   ├── charts.ts      # Chart.js configurations
│   │   ├── dashboard.ts   # Main dashboard controller
│   │   ├── metrics-api.ts # API client
│   │   └── sse-client.ts  # Server-Sent Events client
│   ├── types/
│   │   └── metrics.ts     # TypeScript type definitions
│   ├── utils/
│   │   ├── constants.ts   # Configuration constants
│   │   └── formatters.ts  # Utility functions
│   ├── styles/
│   │   └── main.css      # Tailwind CSS and custom styles
│   └── main.ts           # Application entry point
├── index.html            # HTML template
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.js        # Vite build configuration
└── tailwind.config.js    # Tailwind CSS configuration
```

## Integration

The dashboard is served by FastAPI at `/metrics/dashboard`. The build process creates a single HTML file with all assets inlined for easy deployment.

### API Endpoints Used

- `GET /metrics/summary` - Aggregated metrics summary
- `GET /metrics/data` - Detailed metrics data with filtering
- `GET /metrics/stream` - Real-time SSE stream
- `GET /metrics/health` - System health status

## Charts

1. **Request Volume**: Time series of incoming requests
2. **Response Time Distribution**: Average, P95, P99 latencies
3. **Error Types**: Breakdown of error categories
4. **Model Usage**: Distribution of requests by AI model
5. **Cost Analytics**: Cost tracking over time
6. **Live Activity**: Real-time request feed

## Configuration

The dashboard automatically detects the API base URL and adapts to the current environment. Configuration options are available in `src/utils/constants.ts`.

## Performance

- **Bundle Size**: ~280KB gzipped (single file)
- **Load Time**: < 2s on fast connections
- **Real-time Updates**: SSE with automatic reconnection
- **Chart Performance**: Optimized for up to 100 data points per chart

## Browser Support

Modern browsers with ES2020 support:
- Chrome 85+
- Firefox 85+
- Safari 14+
- Edge 85+
