# Simplified Testing Guide for Dashboard

## Philosophy
Keep it simple. Test what matters for users, mock what's external, focus on behavior not implementation.

## Quick Start
```bash
# Run all tests
bun test && bun e2e

# Run unit tests with watch mode
bun test:watch

# Run with coverage
bun test --coverage

# Run E2E tests
bun e2e

# Debug E2E tests
DEBUG=pw:api bun e2e --headed --trace=on
```

## Test Structure
```
src/
├── lib/
│   ├── components/
│   │   ├── MetricCard.svelte
│   │   └── MetricCard.spec.ts      # Co-located component test
│   └── services/
│       ├── metrics-api.ts
│       └── metrics-api.spec.ts      # Co-located service test
└── tests/
    ├── fixtures/                    # Shared test data
    │   └── analytics-data.ts        # Mock API responses
    └── e2e/
        └── dashboard.spec.ts        # E2E tests
```

## Writing Tests

### What to Mock (External Only)
- API responses (using vi.mock)
- Server-Sent Events streams
- Browser APIs (localStorage, etc.)
- Nothing else

### What NOT to Mock
- Svelte components
- Internal services
- State management ($state, $derived)
- Event handlers
- Any internal logic

## Type Safety Requirements

**REQUIREMENT**: All test files MUST pass TypeScript checking. This is not optional.

### Required Type Annotations
- **Test functions**: Must have proper parameter types
- **Mock data**: Must match API response types
- **Component props**: Must match component interfaces
- **Event handlers**: Must have proper event types

## Examples with Proper Typing

### Basic Component Test
```typescript
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import MetricCard from './MetricCard.svelte';
import type { MetricCardProps } from './MetricCard.svelte';

describe('MetricCard', () => {
  it('displays metric value and change', async () => {
    const props: MetricCardProps = {
      title: 'Total Requests',
      value: '1,234',
      change: 12.5,
      icon: 'chart'
    };

    render(MetricCard, { props });

    expect(screen.getByText('Total Requests')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });
});
```

### Testing API Service
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsApiClient } from './metrics-api';
import type { AnalyticsResponse, QueryParams } from '$lib/types/metrics';

describe('MetricsApiClient', () => {
  let client: MetricsApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MetricsApiClient('/metrics');
  });

  it('fetches analytics data', async () => {
    const mockData: AnalyticsResponse = {
      summary: {
        total_requests: 1000,
        unique_users: 50,
        total_errors: 5,
        error_rate: 0.5
      },
      timeseries: [],
      top_models: [],
      usage_by_service: []
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    } as Response);

    const params: QueryParams = { hours: 24 };
    const result = await client.getAnalytics(params);

    expect(fetch).toHaveBeenCalledWith('/metrics/analytics?hours=24');
    expect(result).toEqual(mockData);
  });
});
```

### Testing Reactive State
```typescript
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Dashboard from './Dashboard.svelte';

describe('Dashboard', () => {
  it('updates metrics on refresh', async () => {
    const { component } = render(Dashboard);

    // Initial state
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for data to load
    await screen.findByText('Total Requests');

    // Trigger refresh
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await fireEvent.click(refreshButton);

    // Verify refresh happened
    expect(screen.getByText('Refreshing...')).toBeInTheDocument();
  });
});
```

### Testing SSE Streams
```typescript
import { describe, it, expect, vi } from 'vitest';
import { setupSSEStream } from './sse-handler';
import type { MetricsStreamEvent } from '$lib/types/metrics';

describe('SSE Stream Handler', () => {
  it('processes stream events', async () => {
    const mockEventSource = {
      addEventListener: vi.fn(),
      close: vi.fn()
    };

    global.EventSource = vi.fn(() => mockEventSource) as any;

    const onUpdate = vi.fn();
    const cleanup = setupSSEStream('/metrics/stream', onUpdate);

    // Simulate event
    const event: MetricsStreamEvent = {
      type: 'request',
      data: { model: 'claude-3', status: 200 }
    };

    const messageHandler = mockEventSource.addEventListener.mock.calls[0][1];
    messageHandler({ data: JSON.stringify(event) });

    expect(onUpdate).toHaveBeenCalledWith(event);

    cleanup();
    expect(mockEventSource.close).toHaveBeenCalled();
  });
});
```

## Fixtures (from test setup)

### Core Fixtures
- `setupTests.ts` - Test environment setup
- `fixtures/analytics-data.ts` - Standard API responses
- `fixtures/sse-events.ts` - SSE stream mocks

### Mock Service Worker Setup
```typescript
// tests/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Test Markers
- `describe.skip` - Temporarily disabled tests
- `it.todo` - Planned tests (fail CI after 4 weeks)
- `it.only` - Focus on specific test (don't commit)

## Best Practices
1. **Keep tests focused** - One test, one behavior
2. **Use descriptive names** - `test_what_when_expected`
3. **Minimal setup** - Use fixtures, avoid duplication
4. **Real components** - Only mock external services
5. **Fast by default** - Mock time-based operations

## Common Patterns

### Testing Error Cases
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import MetricsPanel from './MetricsPanel.svelte';

describe('MetricsPanel error handling', () => {
  it('shows error message on API failure', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    render(MetricsPanel);

    await screen.findByText('Failed to load metrics');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
```

### Testing Loading States
```typescript
it('shows loading then data', async () => {
  const mockData = { total_requests: 100 };
  global.fetch = vi.fn().mockImplementation(() =>
    new Promise(resolve =>
      setTimeout(() => resolve({
        ok: true,
        json: async () => mockData
      }), 100)
    )
  );

  render(MetricsPanel);

  // Initial loading
  expect(screen.getByText('Loading metrics...')).toBeInTheDocument();

  // Wait for data
  await screen.findByText('100 requests');

  // Loading gone
  expect(screen.queryByText('Loading metrics...')).not.toBeInTheDocument();
});
```

### Testing Charts (Dynamic Import)
```typescript
it('renders chart with data', async () => {
  const mockData = [
    { time: '10:00', value: 100 },
    { time: '11:00', value: 150 }
  ];

  render(TimeSeriesChart, { props: { data: mockData } });

  // Charts are dynamically imported, wait for load
  await screen.findByRole('img', { name: /time series chart/i });

  // Verify accessible description
  expect(screen.getByRole('img')).toHaveAttribute(
    'aria-label',
    expect.stringContaining('100 to 150')
  );
});
```

### E2E Testing Pattern
```typescript
import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E', () => {
  test('loads and displays real-time metrics', async ({ page }) => {
    await page.goto('/metrics/dashboard');

    // Wait for initial load
    await expect(page.getByText('Total Requests')).toBeVisible();

    // Verify real-time updates (mock SSE in test)
    await page.waitForTimeout(1000);

    const requestCount = await page.getByTestId('request-count').textContent();
    expect(Number(requestCount?.replace(/,/g, ''))).toBeGreaterThan(0);
  });

  test('filters metrics by time range', async ({ page }) => {
    await page.goto('/metrics/dashboard');

    await page.selectOption('[data-testid="time-filter"]', '1h');
    await expect(page.getByText('Last 1 hour')).toBeVisible();

    // Verify URL updated
    await expect(page).toHaveURL(/\?range=1h/);
  });
});
```

## Running Tests

### Bun Commands
```bash
bun test              # Run all unit tests
bun test:watch        # Watch mode
bun test:coverage     # With coverage report
bun e2e               # Run E2E tests
bun e2e:ui           # Playwright UI mode
```

### Direct Commands
```bash
vitest -t "MetricCard"    # Run matching tests
vitest --run              # Single run
playwright test --debug   # Debug E2E
```

## Debugging Tests

### Visual Debugging
```typescript
import { render, screen, debug } from '@testing-library/svelte';

it('debug test output', () => {
  render(Component);

  // Print entire DOM
  debug();

  // Print specific element
  debug(screen.getByRole('button'));
});
```

### Playwright Debugging
```bash
# Run with UI mode
bun e2e --ui

# Debug specific test
bun e2e --debug dashboard.spec.ts

# Save trace on failure
bun e2e --trace=on-first-retry
```

## For New Developers

1. **Start here**: Read this file and example tests
2. **Run tests**: `bun test` to ensure everything works
3. **Add new test**: Copy existing test pattern, modify as needed
4. **Mock external only**: Don't mock Svelte components or stores
5. **Ask questions**: Tests should be obvious, if not, improve them

## For LLMs/AI Assistants

When writing tests for this project:
1. **MUST include proper type hints** - All parameters and mock data typed
2. **MUST pass TypeScript checks** - Type safety is required
3. Use the existing test patterns shown above
4. Only mock external APIs and browser APIs
5. Use Testing Library queries, not CSS selectors
6. Keep tests simple and focused
7. Follow the naming convention: `describe('Component')` and `it('does something')`
8. Import types from `$lib/types/metrics`

**Type Safety Checklist:**
- [ ] All mock data matches API response types
- [ ] Component props match interface definitions
- [ ] Event handlers have proper event types
- [ ] No `any` types unless absolutely necessary
- [ ] Code passes `bun run check`

## Decision Trees

### Should I Write a Test?
```
Is it a user-facing feature?
├─ Yes → Write E2E test
└─ No → Is it an API integration?
    ├─ Yes → Write service test
    └─ No → Is it a reusable component?
        ├─ Yes → Write component test
        └─ No → Skip test (internal utility)
```

### What Type of Test?
```
Does it involve multiple pages/components?
├─ Yes → E2E test
└─ No → Is it testing API responses?
    ├─ Yes → Service/integration test
    └─ No → Component unit test
```

## Testing Priorities (One Dev Project)

### High Priority
1. **API Integration** - Test service methods handle responses/errors correctly
2. **Critical User Flows** - Dashboard loads, real-time updates work
3. **Error States** - API failures show proper messages
4. **Data Transformations** - Chart data formatting is correct

### Medium Priority
1. **Component Props** - Basic rendering with different props
2. **User Interactions** - Filters, refresh buttons work
3. **Accessibility** - ARIA labels, keyboard navigation

### Low Priority
1. **Visual Details** - Exact styling, animations
2. **Performance** - Unless specific issues arise
3. **Edge Cases** - Unless they affect core functionality

## Remember

- **Simple > Complex** - Basic tests that run are better than elaborate tests that don't
- **User Focus** - Test what users see and do, not how it works internally
- **Fast Feedback** - Keep tests fast so you run them often
- **Maintainable** - Tests should be easy to understand and update
- **No Emoji** - Use text descriptions in test names and assertions

This is a living document. Update it when you find better patterns or tools.
