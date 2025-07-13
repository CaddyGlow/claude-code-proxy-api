# Dashboard UI Components

This directory contains Svelte 5 UI components for the Claude Code Proxy dashboard, built with Svelte 5 runes and TypeScript.

## Components Overview

### MetricCard.svelte
A reusable component for displaying key metrics with icons and change indicators.

**Props:**
- `metric: MetricCard` - The metric data to display
- `class?: string` - Additional CSS classes

**Usage:**
```svelte
<script>
  import { MetricCard } from '$lib/components';

  const metric = {
    id: 'total-requests',
    label: 'Total Requests',
    value: '12,453',
    icon: 'requests',
    iconColor: 'blue',
    change: '+12%',
    changeColor: 'green'
  };
</script>

<MetricCard {metric} />
```

### ActivityFeed.svelte
Real-time activity stream component that displays a scrollable list of activities.

**Props:**
- `items: ActivityItem[]` - Array of activity items
- `isLoading?: boolean` - Loading state
- `class?: string` - Additional CSS classes

**Features:**
- Auto-scroll to bottom for new items
- Preserves scroll position when user scrolls up
- Loading and empty states
- Accessibility support

**Usage:**
```svelte
<script>
  import { ActivityFeed } from '$lib/components';

  let activities = [
    {
      id: '1',
      timestamp: new Date().toISOString(),
      type: 'request',
      title: 'POST /v1/chat/completions',
      subtitle: 'Model: claude-3-5-sonnet',
      status: 'info'
    }
  ];
</script>

<ActivityFeed items={activities} />
```

### TimeRangeSelector.svelte
Dropdown selector for time range filtering.

**Props:**
- `selectedRange: TimeRange` - Currently selected time range
- `options?: TimeRangeOption[]` - Available time range options
- `disabled?: boolean` - Whether the selector is disabled
- `class?: string` - Additional CSS classes
- `onTimeRangeChange: TimeRangeChangeCallback` - Callback when selection changes

**Usage:**
```svelte
<script>
  import { TimeRangeSelector } from '$lib/components';

  let currentRange = '24h';

  const handleTimeRangeChange = (timeRange) => {
    currentRange = timeRange;
    // Load new data...
  };
</script>

<TimeRangeSelector
  selectedRange={currentRange}
  onTimeRangeChange={handleTimeRangeChange}
/>
```

### LoadingOverlay.svelte
Full-screen loading overlay with customizable message.

**Props:**
- `loading: LoadingState` - Loading state object
- `class?: string` - Additional CSS classes

**Features:**
- Backdrop blur effect
- Accessible loading indicator
- Prevents body scroll
- Fade-in animation
- Reduced motion support

**Usage:**
```svelte
<script>
  import { LoadingOverlay } from '$lib/components';

  let loading = { isLoading: false };

  const startLoading = () => {
    loading = { isLoading: true, message: 'Loading data...' };
  };
</script>

<LoadingOverlay {loading} />
```

### ErrorBoundary.svelte
Error display component with retry functionality and optional details.

**Props:**
- `error: ErrorState` - Error state object
- `onRetry?: ErrorRetryCallback` - Optional retry callback
- `class?: string` - Additional CSS classes
- `showDetails?: boolean` - Whether to show error details

**Features:**
- Accessible error display
- Optional retry button
- Collapsible error details
- Auto-focus for screen readers

**Usage:**
```svelte
<script>
  import { ErrorBoundary } from '$lib/components';

  let error = { hasError: false };

  const handleRetry = () => {
    error = { hasError: false };
    // Retry operation...
  };
</script>

<ErrorBoundary {error} onRetry={handleRetry} showDetails={true} />
```

## Types

All components use TypeScript interfaces defined in `../types.ts`:

- `MetricCard` - Metric display data
- `ActivityItem` - Activity feed item data
- `TimeRange` - Time range values
- `LoadingState` - Loading state
- `ErrorState` - Error state
- Various callback types

## Styling

Components use:
- **Tailwind CSS** for styling
- **Custom Claude theme colors** (defined in `app.css`)
- **Component-scoped styles** for specific styling needs
- **Responsive design** principles
- **Accessibility** features (ARIA labels, semantic HTML)

## Claude Theme Colors

The components use custom Claude brand colors:
- `--claude-500`: Primary brand color
- `--claude-600`: Primary dark variant
- `--claude-700`: Hover/active states

## Accessibility Features

All components include:
- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Reduced motion preferences
- Semantic HTML structure

## Svelte 5 Runes

Components use modern Svelte 5 features:
- `$state()` for local component state
- `$derived()` for computed values
- `$effect()` for side effects
- `$props()` for prop declarations
- TypeScript integration

## Development

To add new components:
1. Create the `.svelte` file in this directory
2. Add proper TypeScript types
3. Include accessibility features
4. Use Claude theme colors
5. Add to the index.ts exports
6. Update this README

## Example Usage

See `src/routes/+page.svelte` for a complete example of how all components work together in a dashboard layout.
