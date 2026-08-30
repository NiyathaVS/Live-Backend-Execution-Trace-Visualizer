# Live Backend Execution Trace Visualizer

**Companion docs**
- [Architecture Diagrams](docs/ARCHITECTURE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Feature Checklist](docs/FEATURES.md)
- [Engineering Onboarding](docs/ENGINEERING_ONBOARDING.md)
- [Portfolio / Resume Narrative](docs/PORTFOLIO_RESUME_VERSION.md)
- [Implementation History](IMPLEMENTATION_SUMMARY.md)

---

## 1. Project Overview

A full-stack, real-time execution tracing system for Spring Boot applications. Method calls are instrumented at runtime via AOP, producing structured `TraceEvent` records that stream over WebSocket to a professional three-column React observability dashboard.

**Current capabilities:**

- Runtime tracing of all `@RestController` / `@Service` / `@Repository` calls with stable UUID span IDs
- SQL query tracing via custom JDBC proxy with N+1 pattern detection
- Statistical metrics (p50/p95/p99) per method with anomaly detection
- Root-cause analysis with automatic hint generation
- Rule-based alert engine with severity levels
- Cross-request trace diff (added/removed methods, timing deltas)
- Trace persistence, share links, and multi-format export (JSON, SVG, PDF, OTEL)
- Async context propagation for `@Async` and `CompletableFuture`
- Distributed trace header propagation (W3C `traceparent`, `X-Trace-Id`)
- Production hardening: configurable sampling, TTL+LRU memory management, PII redaction, WebSocket auth

The repository has two active modules:

- **`instrumented-app`** — Spring Boot app with AOP tracing, in-memory collector, analysis engine, and all REST/WebSocket APIs
- **`frontend`** — React + D3 dashboard with professional observability UI

---

## 2. High-Level Architecture

### Backend (`instrumented-app`)

- `RequestIdFilter` — assigns UUID `requestId` per request, stores in MDC
- `TraceAspect` — AOP `@Around` advice building `TraceEvent` objects (Lombok `@Builder`)
- `InMemoryTraceCollector` — builds `CallTreeNode` trees; sets risk flags, critical path, LRU+TTL retention, sampling
- `TraceRootCauseAnalyzer` — derives `rootCauseHints`, `nPlusOneWarnings`, `anomalies`
- `TraceAlertService` — rule-based alert firing with ERROR/WARN severity
- `TraceWebSocketHandler` — broadcasts live events to all connected sessions
- `TracingDataSource` / `SqlTraceListener` — JDBC proxy capturing SQL text, duration, slow flag
- `SensitiveDataRedactor` — pattern-based PII/credential scrubbing
- `GlobalExceptionHandler` — `@RestControllerAdvice` that catches unhandled exceptions and returns JSON error responses tagged with `requestId` from MDC
- `ReactorTraceContextConfig` / `ReactorTraceContextAccessor` — Reactor `Mono`/`Flux` context propagation; wraps reactive chains to carry `parentSpanId` and MDC across thread hops
- REST API layer — metrics, search, diff, persistence, export, source lookup, replay

### Frontend (`frontend`)

- `useTraceStream` hook — WebSocket connection with auto-reconnect; writes to `eventsByRequest`
- `useSearchAndMetrics` hook — polls metrics, alerts, history, search every 15 s
- `useComparisonState` hook — fetches diff report from backend when compare request selected
- `buildTracesFromEvents` (traceUtils.js) — builds call trees from raw events (tolerates out-of-order delivery)
- Dashboard shell: KPI Bar → Sidebar Tabs → Alert Rail → Toolbar → Visualizations

---

## 3. Backend Details

### 3.1 Runtime Tracing Pipeline

1. HTTP request arrives → `RequestIdFilter` creates UUID `requestId` → stored in MDC
2. AOP proxy wraps each traced method via `TraceAspect`
3. On method entry: peek parent `spanId` from `TraceStack`, push current `spanId`
4. On method exit (or throw): compute duration, CPU time, capture params/return/error, build `TraceEvent`
5. `TraceEvent` is simultaneously:
   - Logged to console as JSON (`ConsoleTraceEventPublisher`)
   - Added to `InMemoryTraceCollector` (tree building, heuristics, critical path, sampling, alerts)
   - Broadcast to all WebSocket sessions (`TraceWebSocketHandler`)
6. SQL queries intercepted by JDBC proxy follow the same collector + broadcast path

### 3.2 Core Backend Classes

| Class | Responsibility |
|-------|---------------|
| `RequestIdFilter` | UUID `requestId` → MDC; stack cleanup on request end |
| `TraceStack` + `TraceContext` | ThreadLocal deque for parent-child span tracking |
| `TraceAspect` | AOP `@Around` for controller/service/repository |
| `TraceEvent` | Immutable event record, Lombok `@Builder` |
| `InMemoryTraceCollector` | Tree building, LRU+TTL, sampling, heuristics, critical path |
| `TraceRootCauseAnalyzer` | Hints, N+1 warnings, anomalies, contention detection |
| `TraceAlertService` | Rule-based alerts, ERROR/WARN severity |
| `MetricsDashboardReport` + stats | p50/p95/p99/variance/errorRate per method |
| `TraceSearchService` | Method/duration/error filter with limit |
| `TracePersistenceService` | File-based persistence, share links, history |
| `TraceWebSocketHandler` | Session management, JSON broadcast |
| `SensitiveDataRedactor` | Pattern-based PII/credential scrubbing |
| `SqlTraceListener` | SQL event creation from JDBC proxy |
| `TracingDataSource` / `TracingStatement` | JDBC proxy chain |
| `AsyncContextPropagator` | `@Async` span continuity via `TaskDecorator` |
| `DistributedTraceInterceptor` | Outbound `X-Trace-Id` / `traceparent` propagation |
| `WebSocketAuthInterceptor` | Shared-secret `?token=` handshake guard |
| `GlobalExceptionHandler` | `@RestControllerAdvice`; MDC-tagged JSON error responses for all unhandled exceptions |
| `ReactorTraceContextConfig` | Captures and restores `parentSpanId` + MDC across Reactor operator hops |
| `ReactorTraceContextAccessor` | Convenience bean — `withTraceContext(Mono/Flux)` wraps reactive chains |

### 3.3 `TraceEvent` Wire Format

| Field | Type | Notes |
|-------|------|-------|
| `eventId` | UUID string | Per-event unique identifier |
| `spanId` | UUID string | Per-invocation stable ID |
| `parentSpanId` | UUID string | Parent invocation span |
| `requestId` | UUID string | HTTP request correlation |
| `method` / `methodName` | string | Fully-qualified method signature |
| `params` | object | Redacted method arguments |
| `returnValue` | any | Redacted return value |
| `executionTimeMs` | long | Wall-clock duration |
| `threadCpuTimeMs` | long | CPU time via `ThreadMXBean` |
| `threadName` / `threadState` | string | OS thread name + JVM state |
| `timestamp` | ISO-8601 string | Invocation start time |
| `status` | `SUCCESS` \| `ERROR` | Outcome |
| `errorType` / `errorMessage` / `errorStackTrace` | string | Full exception detail |
| `sourceFile` / `sourceLine` | string / int | AspectJ `SourceLocation` |
| `eventType` | `METHOD` \| `SQL` | Span category |
| `slowPath` / `isOnCriticalPath` | boolean | Collector heuristics |
| `contentionRisk` / `resourceLeakSuspicion` / `logicGapRisk` | boolean | Additional risk signals |
| `slowQuery` | boolean | SQL-only: execution ≥500ms |
| `sql` | string | SQL-only: query text |

### 3.4 Backend REST APIs

Base path: `/traces`

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/{requestId}` | Text tree |
| `GET` | `/{requestId}/json` | Full `CallTreeNode` JSON |
| `GET` | `/{requestId}/analysis` | `TraceAnalysisReport` (hints, warnings, N+1, anomalies) |
| `GET` | `/diff` | `TraceDiffReport` (added/removed methods, timing deltas) |
| `GET` | `/metrics/dashboard` | `MetricsDashboardReport` (p50/p95/p99 per method, anomalies) |
| `GET` | `/search` | `TraceSearchResult[]` filtered by method/duration/error |
| `GET` | `/history` | `PersistedTraceSummary[]` |
| `GET` | `/alerts` | `TraceAlert[]` (optionally scoped to `?requestId=`) |
| `POST` | `/{requestId}/persist` | `PersistedTraceReference` (shareId, sharePath) |
| `GET` | `/{requestId}/export/json` | Raw JSON export |
| `GET` | `/{requestId}/export/svg` | SVG diagram export |
| `GET` | `/{requestId}/export/pdf` | PDF report export |
| `GET` | `/{requestId}/export/otel` | OpenTelemetry OTLP JSON |
| `GET` | `/source` | Source snippet (`className`, `lineNumber`, `contextLines`) |
| `GET` | `/{requestId}/source` | Request-scoped source snippet |
| `POST` | `/{requestId}/replay` | Safe replay instructions (no execution) |

Additional demo endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users/{id}` | Triggers a 9-method call tree |
| `GET` | `/orders/{id}/fulfillment` | Triggers a complex multi-service order flow |

### 3.5 WebSocket Endpoint

- Default: `ws://localhost:8080/ws/traces`
- Configured via frontend `VITE_WS_URL` or derived from `VITE_API_URL`
- Sends serialized `TraceEvent` JSON in real time as each method completes
- Auth: optional shared-secret `?token=` query parameter

### 3.6 Configuration (`application.yml`)

```yaml
trace:
  enabled: true
  max-traces: 1000          # LRU eviction limit
  ttl-seconds: 3600         # 1 hour retention (0 = unlimited)
  sampling: all             # "all", "slow" (>500ms), or percentage like "10"
  redaction:
    enabled: true           # Redact passwords, tokens, PII
  websocket:
    allowed-origins: "http://localhost:5173"
    auth-token: "none"      # Set to a secret string to require token auth
```

**Port reference (single source of truth):**
- Backend: `8080` (Spring Boot default)
- Frontend: `5173` (Vite default)

---

## 4. Frontend Details

### 4.1 State Model

The frontend never trusts arrival order. Raw events are stored by request, and `buildTracesFromEvents` reconstructs the full tree on every update:

- `eventsByRequest: { [requestId]: TraceEvent[] }` — raw event map from WebSocket
- `traces` — derived call trees (re-built on every event batch)
- `selectedRequestId` / `compareRequestId` — independent view controls
- `requestStats` — per-request aggregates computed client-side (errors, slow, contention, totalMs)

### 4.2 Dashboard Shell (`App.jsx`)

The dashboard is a fixed-height 3-column grid that fills the viewport. No full-page scroll — each region independently scrolls its own content.

**Header (52 px):**
- Gradient top-line accent, glass blur backdrop
- Logo with brand gradient, gradient-text wordmark
- Live pill (LIVE badge + ev/s counter), alerts pill, Pause/Resume, Clear

**KPI Summary Bar (`KpiBar.jsx`) — 4 cards:**
- Live Traces · Error Rate · Peak p99 · Active Alerts
- Each card: ambient glow blob, neon value text, sub-label, bottom accent line
- Colour-coded with green / orange / red thresholds

**Left sidebar (260 px) — 2 tabs:**
1. **Traces** — NeoInput search/filter, request cards with health grade (A–F with numeric score), duration bar, error/slow/SQL/contention badges, relative timestamp, bookmark star
2. **Search** — method name / min duration / errors-only filters; search results + persisted history
- Alert dock always visible at bottom when alerts are active

**Centre panel (flex 1):**
- `TraceSummaryBar` — request ID chip, health grade badge, summary chips (spans/peak/errors/slow/SQL/contention), view toggle, compare dropdown, Export dropdown
- `SpanStatsMiniRow` — 8 live numbers: Total Duration · Spans · Errors · Slow Paths · SQL Queries · Critical Path · Threads · Peak Span
- `AlertRail` — collapsible per-severity notification banner
- Scrollable content: `TraceTree` or `FlameGraph` (toggled) → `RequestTimeline` → `NodeDetailPanel` (on node select) → `ComparisonSection` (on compare select) → `SqlInspector` (when SQL spans present)

**Right insight rail (280 px) — always visible, auto-scrollable:**
- `AnalysisBanner` — root-cause hints, N+1 warnings, anomalies
- **Slowest Spans** — top 6 spans by duration, each with inline proportional bar
- **Span Breakdown** — METHOD/SQL/ERROR type counts with percentage bars
- `LocalMethodMetrics` — method latency table computed client-side from `flatEvents` (no backend call): call count, error%, max ms, relative bar

**Empty state:**
- 6-card feature overview grid (colour-tinted per feature)
- Two sample request buttons with loading / success / error / glow feedback

### 4.3 Visualization Components

| Component | Description |
|-----------|-------------|
| `TraceTree.jsx` | D3 force-graph; collapsible, filterable, particle animation on new events; natural SVG height (≥460 px) |
| `FlameGraph.jsx` | Click-to-zoom with breadcrumbs; hotspot sidebar; critical-path glow; risk chips; 440 px fixed height with internal scroll |
| `RequestTimeline.jsx` | Thread swimlane; 1×–20× zoom; drag-to-pan; colour-coded span types |
| `NodeDetailPanel.jsx` | Info / Params / Stack Trace / SQL tabs per selected node |
| `SqlInspector.jsx` | N+1 detection; queries grouped by text; per-call timing chips; stat cards with glow |
| `KpiBar.jsx` | 4 headline KPI cards; ambient glow blobs; neon value text; bottom accent line |
| `AlertRail.jsx` | Collapsible alert banner; per-alert dismiss; critical pulse animation |
| `ExportDropdown.jsx` | JSON/SVG/PDF/OTEL download + share link generation in one menu |
| `ComparisonSection.jsx` | Diff summary + side-by-side trees + overlay timeline |
| `ComparisonView.jsx` | D3 side-by-side trees with added/removed highlighting |
| `OverlayTimeline.jsx` | Base vs. compare time-axis overlay |
| `AnalysisBanner.jsx` | Root-cause hints / N+1 warnings / anomalies banner |
| `MetricsDashboard.jsx` | p50/p95/p99 sparkbars; anomaly callout; hot method highlighting (used in Stats sidebar if backend reachable) |
| `CodePreview.jsx` | Inline Java source viewer; fetches snippet from `GET /traces/source`; highlights keywords, strings, comments, numbers; shows ±7 context lines around the target line |

### 4.4 Frontend Service Layer

| Module | Responsibility |
|--------|---------------|
| `services/websocket.js` | WebSocket lifecycle; exponential-backoff reconnect (1 s → 30 s cap) |
| `services/traceApi.js` | REST API client (metrics, diff, search, history, alerts, export, persist) |
| `services/traceUtils.js` | Pure functions: `computeMetrics`, `flattenEvents`, `buildTracesFromEvents`, `extractClassNameFromMethod` |
| `hooks/useTraceStream.js` | WebSocket event ingestion; pause/resume; `latestEvent` for animations |
| `hooks/useSearchAndMetrics.js` | Polls metrics, alerts, history; debounces search |
| `hooks/useComparisonState.js` | Manages compare request selection + diff API fetch |

---

## 5. Testing

### Backend (JUnit)

- Call tree building: span ID linkage, out-of-order events, orphan spans, duplicate methods
- Diff logic: added/removed methods, timing deltas, edge cases
- Redaction: password/token/PII patterns, long string detection, non-string preservation
- Concurrency: parallel ingestion, LRU under load, WebSocket broadcast under concurrent reads
- OTel export: OTLP JSON structure validation
- Search: method filter, duration filter, error filter

```bash
cd instrumented-app && ./gradlew test
```

### Frontend (Vitest — 17 tests)

- `computeMetrics` — slow-path selection, node counting, maxExecution
- `flattenEvents` — DFS ordering, ROOT node exclusion
- `extractClassNameFromMethod` — FQN parsing, edge cases
- `buildTracesFromEvents` — span linkage, orphan handling, multi-request isolation

```bash
cd frontend && npm test
```

### CI/CD (GitHub Actions)

- Both test suites run on every push and PR
- Frontend build (`npm run build`) validated on every push
- Test and build artifacts uploaded

---

## 6. Known Gaps & Honest Scope

| Area | Status |
|------|--------|
| WebFlux / Reactor Context propagation | Not implemented |
| Cross-service distributed span merging | Partial — infrastructure exists, merge logic incomplete |
| Persistent storage (DB / object store) | File-based only; single-instance |
| Alert acknowledgement API | Not implemented — alerts accumulate |
| Time-series latency endpoint | Not implemented — metrics returns aggregate snapshot |
| Accessibility (keyboard nav, ARIA) | Minimal |

---

## 7. Suggested Next Engineering Steps

1. **Deploy** — Railway/Render (backend) + Vercel/Netlify (frontend) for a publicly shareable live demo
2. **Time-series endpoint** — add `GET /traces/metrics/timeseries?method=X&buckets=20` to power latency trend charts in the right rail
3. **Alert acknowledgement** — `POST /traces/alerts/{id}/acknowledge` so alerts can be dismissed server-side
4. **WebFlux support** — Reactor `Context` propagation for fully reactive stacks
5. **Persistent storage** — swap file-based persistence for PostgreSQL or object storage for multi-instance deployments
6. **Accessibility** — keyboard navigation and ARIA roles for the D3 visualisations

---

## 8. Quick Run Reference

```bash
# Backend
cd instrumented-app && ./gradlew bootRun
# → http://localhost:8080

# Frontend
cd frontend && npm install && npm run dev
# → http://localhost:5173

# Trigger traces
curl http://localhost:8080/users/2
curl http://localhost:8080/orders/1001/fulfillment
```
