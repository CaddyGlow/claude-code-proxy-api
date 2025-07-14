# Svelte 5 Real-Time Metrics Dashboard  
### Testing Methodology (Single Source of Truth)

> Applies to this repository only.  
> Target stack: **Svelte 5 + TypeScript + Vitest + @testing-library/svelte + Playwright**.  
> Audience: Solo developer, future contributors, and AI assistants.  
> File length target: 200-400 lines => remain concise; each line matters.

---

## 1. Core Principles & Philosophy
1. **User-focused reliability** – Tests must protect the user experience of a live data dashboard.
2. **Fast feedback loop** – Local test run ≤ 5 s (unit) / ≤ 30 s (e2e) on M-class laptop.
3. **Smallest necessary scope** – Test the contract, *never* the implementation details.
4. **Determinism** – No flakiness; mock time, network, and SSE streams.
5. **Living documentation** – Tests double as spec, so name, structure, and comments matter.
6. **Cost-benefit conscious** – Time writing/maintaining a test ≤ average time saved catching regressions.
7. **Green main** – `main` branch must pass `bun test:ci` and `bun e2e:ci` at all times.

---

## 2. What to Test (With Examples)
| Layer | Contract examples | Recommended tool |
|-------|------------------|------------------|
| Pure utilities | `formatBytes`, `debounce`, math helpers | Vitest |
| Store logic | Derived/ writable stores (e.g., `src/lib/stores/metrics.ts`) | Vitest |
| Component rendering | `<MetricCard>` renders value + change Δ | @testing-library/svelte |
| Interaction flow | Clicking timeframe button updates graph & query params | @testing-library/svelte |
| SSE handling | Reconnect logic emits `connectionLost` then `reconnected` | Vitest (with `msw` SSE mock) |
| Integration slice | `<Dashboard>` + mocked SSE shows streaming updates | @testing-library/svelte |
| Critical e2e | Happy-path navigation, auth stub, real backend in staging | Playwright |
| Accessibility | `aria-*`, colour-contrast violations on key pages | Playwright `expect(accessibility.snapshot())` |

---

## 3. What **NOT** to Test (Rationale)
1. **Third-party packages** – Trust Svelte internals, D3, ChartJS, etc. (they have own suites).
2. **CSS/styling details** – Snapshot CSS only when rendering drives logic.
3. **Console logs/analytics calls** – Unless contractually required for billing.
4. **Minor refactor noise** – DOM class names, exact markup order, `key` props.
5. **Brute-force combinatorics** – Test boundaries, not every permutation.
6. **Network layer of SSE library** – Already covered; only test our reconnection wrapper.

---

## 4. Test Categories & Priority Matrix
| Priority | Category | Gate in CI? | Failure impact |
|----------|----------|-------------|----------------|
| P0 | Unit: utility, store | Yes | Build should halt |
| P0 | SSE reconnection | Yes | Live data freeze |
| P1 | Component render + interaction | Yes | UI breakage |
| P1 | Critical e2e flows (login, dashboard load) | Yes | User lockout |
| P2 | Accessibility snapshots | Warn only | Legal/regulatory |
| P3 | Visual regression (optional) | Manual review | Cosmetic |

---

## 5. Setup & Tooling Guide
1. **Install**  
   ```bash
   bun add -d vitest @testing-library/svelte @vitest/coverage-v8 \
           playwright @playwright/test msw
   ```
2. **Key bun scripts**
   - `test`: `vitest run --coverage`
   - `test:watch`: `vitest`
   - `e2e`: `playwright test`
   - `e2e:ci`: `playwright test --reporter=line`
3. **Vitest config** (`vitest.config.ts`)
   - `environment: 'jsdom'`
   - Alias `'$lib': './src/lib'`
   - Coverage at 80% statements; exclude `**/*.d.ts`,`**/stories/**`
4. **Playwright config** (`playwright.config.ts`)
   - Headless by default; use Chromium
   - BaseURL: `http://localhost:5173`
   - Collect traces on failure
5. **Mock Service Worker** (`setupTests.ts`)
   ```ts
   import { server } from './tests/mocks/sseServer';
   beforeAll(() => server.listen());
   afterEach(() => server.resetHandlers());
   afterAll(() => server.close());
   ```
6. **SSE Mock** – Provide helper `createSSEMock(url, events[])` for deterministic streaming tests.

---

## 6. Writing Guidelines & Best Practices
1. **AAA pattern** – Arrange, Act, Assert; 3 empty lines separate sections.
2. **File naming** – `Component.spec.ts`, `utility.test.ts`. Locate next to source (`co-locate`).
3. **Use screen queries**  
   ```ts
   const btn = screen.getByRole('button', { name: /1h/i });
   ```
4. **Avoid magic timers** – Use `vi.useFakeTimers()` and advance precisely.
5. **SSE tests** – Use `flushPromises()` helper to await event loop before asserts.
6. **Snapshot judiciously** – Limit to small, stable markup (`toMatchInlineSnapshot()`).
7. **Helper utils** – Export from `tests/utils/` only when reused ≥ 3 times.
8. **Skip vs. todo**  
   - `test.skip` for flaky/blocked  
   - `test.todo` for planned coverage; auto-fail in CI after 4 weeks via lint rule.
9. **Playwright style** – Page Object per route (`DashboardPage`) to encapsulate selectors.
10. **Accessibility** – Use `expect(await page.accessibility.snapshot()).toBeDefined()`.

---

## 7. Maintenance & Evolution Rules
1. **Red-green-refactor** – Always add a failing test before bugfix.
2. **Code review checklists** include test delta; PR rejected if coverage drops > 1%.
3. **Quarterly audits**  
   - Remove obsolete tests (component removed / requirement changed).  
   - Tag flakiest 5% for refactor.
4. **Version bumps** – When Svelte major updates, re-run `bun test --updateSnapshot`, fix breakages.
5. **Deprecated patterns** – Ban `await tick()` outside helper; replace with `await waitFor(() => …)`.
6. **CI runtime budget** – Keep vitest < 5 s, e2e suite < 3 m. Trim or parallelize when exceeded.
7. **Flaky test protocol**  
   - Reproduce locally with `--repeat-each 5`.  
   - If reproducible → fix. If environment-specific → quarantine + create Issue.

---

## 8. Decision Trees for New Tests

### 8.1 Should I Write a Unit Test?
```
Change touches pure logic?
 ├─ Yes → Cover input/output, edge cases. (Vitest)
 └─ No  → See next tree.
```

### 8.2 Should I Write a Component Test?
```
Is component behavior user-visible OR prop contract public?
 ├─ Yes → Write render/interaction test.
 └─ No  → Skip; rely on parent integration.
```

### 8.3 Should I Write an e2e Test?
```
Does feature span >1 page OR depend on real backend?
 ├─ Yes & critical (auth, dashboard) → Playwright.
 ├─ Yes but non-critical → Consider lower layer mocks.
 └─ No  → Stay at component test.
```

### 8.4 Snapshot Decision
```
Markup stable & small (<20 lines)?
 ├─ Yes → Inline snapshot.
 └─ No  → Prefer explicit assertions.
```

---

## 9. Quick Reference (Cheat Sheet)
| Task | Command |
|------|---------|
| Run all tests | `bun test && bun e2e` |
| Watch unit tests | `bun test:watch` |
| Update snapshots | `bun test -u` |
| Debug e2e | `DEBUG=pw:api bun e2e --headed --trace=on` |
| Generate coverage | `open coverage/index.html` |

---

## 10. Glossary
- **SSE** – Server-Sent Events; uni-directional, keep-alive stream.
- **MSW** – Mock Service Worker; intercepts `fetch/EventSource`.
- **PO** – Page Object; abstraction around Playwright `page`.
- **Flakiness** – Non-deterministic test outcome across identical runs.

---

_End of methodology. Keep this file up-to-date with each significant architectural or tooling change._
