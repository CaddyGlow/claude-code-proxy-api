# Claude Code Proxy Dashboard

Real-time metrics dashboard for Claude Code Proxy API Server, built with Svelte 5 and LayerChart.

## Features

- **Real-time Metrics**: Live charts displaying request volume, response times, error rates, and model usage
- **Modern Architecture**: Built with Svelte 5 runes for optimal performance
- **Interactive Charts**: LayerChart-powered visualizations with tooltips and legends
- **Responsive Design**: Works on desktop and mobile devices
- **SSE Streaming**: Real-time updates via Server-Sent Events

## Development

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- The dashboard is designed to work with the Claude Code Proxy API Server

### Setup

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Open browser at http://localhost:5173
```

### Available Scripts

- `bun run dev` - Start development server with hot reload
- `bun run build` - Build for production (static files)
- `bun run build:prod` - Build and copy to main application
- `bun run preview` - Preview production build locally
- `bun run check` - Run TypeScript and linting checks

## Architecture

### Modern Svelte 5 Patterns

The dashboard uses the latest Svelte 5 features:

- **Runes**: `$state`, `$derived`, `$effect` for reactive programming
- **Modern Props**: `let { data } = $props()` instead of `export let data`
- **Component Lifecycle**: `onMount()` with cleanup returns
- **Type Safety**: Full TypeScript integration with generated types

### Chart Components

Built with LayerChart for better Svelte integration:

- **RequestVolumeChart**: Bar chart showing request counts over time
- **ResponseTimeChart**: Multi-line chart for P50/P95/P99 response times
- **ErrorRateChart**: Line chart displaying error percentages
- **ModelUsageChart**: Pie chart for model usage distribution

### Data Flow

1. **Initial Load**: Fetches historical metrics and summary data
2. **Real-time Updates**: Subscribes to SSE stream for live data
3. **Reactive State**: Charts automatically update when data changes
4. **Browser-only Rendering**: Dynamic imports prevent SSR issues

## Deployment

The dashboard is built as a Single Page Application (SPA) and integrated into the main API server:

### Production Build

```bash
# Build and copy to main application
bun run build:prod
```

This command:
1. Builds the SPA to the `build/` directory
2. Copies the entire build folder to `../ccproxy/static/dashboard/`
3. Makes it available at `/metrics/dashboard` in the API server

### Static File Serving

The API server automatically serves:
- Dashboard HTML at `/metrics/dashboard`
- Static assets at `/_app/*` (JS, CSS, images)
- Favicon at `/metrics/dashboard/favicon.svg`

## API Integration

The dashboard connects to these API endpoints:

- `GET /api/metrics/summary` - Current metrics summary
- `GET /api/metrics/data` - Historical metrics data
- `GET /api/metrics/stream` - SSE stream for real-time updates
- `GET /api/metrics/health` - System health status

## Browser Compatibility

- **Modern Browsers**: Chrome 90+, Firefox 90+, Safari 14+, Edge 90+
- **Features Used**: ES2022, CSS Grid, CSS Variables, EventSource
- **Responsive**: Mobile-first design with responsive breakpoints

## Troubleshooting

### Build Issues

If you encounter build errors:

```bash
# Clear cache and reinstall
rm -rf node_modules .svelte-kit
bun install
bun run build:prod
```

### Development Server Issues

```bash
# Restart development server
bun run dev
```

### Chart Loading Issues

The charts load dynamically to avoid SSR conflicts. If charts don't appear:

1. Check browser console for errors
2. Verify API endpoints are accessible
3. Ensure the build includes LayerChart dependencies

## Contributing

1. Follow the existing code style and patterns
2. Use Svelte 5 runes (`$state`, `$derived`) not legacy patterns
3. Test responsive design on mobile devices
4. Ensure TypeScript types are correct
5. Run `bun run check` before committing
