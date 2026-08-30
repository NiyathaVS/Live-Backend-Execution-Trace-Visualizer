# Live Backend Execution Trace Visualizer — Complete Feature List

---

## Backend: Core Tracing

### ✅ Runtime Method Tracing
- AOP interception of `@RestController`, `@Service`, and `@Repository` via `TraceAspect`
- ThreadLocal `TraceStack` preserves parent-child call depth per thread
- `RequestIdFilter` assigns a UUID `requestId` per HTTP request; stored in MDC
- Every method invocation produces a `TraceEvent` built via Lombok `@Builder`

### ✅ Trace Data Model (`TraceEvent`)
| Field | Description |
|-------|-------------|
| `eventId`, `spanId` | UUID per invocation — stable identifier |
| `parentSpanId` | UUID of parent — reliable tree linkage |
| `requestId` | Correlation ID for the HTTP request |
| `method`, `methodName` | Fully-qualified method signature |
| `params`, `returnValue` | Captured arguments and return (with redaction) |
| `executionTimeMs` | Wall-clock duration |
| `threadCpuTimeMs` | Actual CPU time via `ThreadMXBean` |
| `threadName`, `threadState` | OS thread name and JVM thread state |
| `timestamp` | ISO-8601 invocation time |
| `status` | `SUCCESS` or `ERROR` |
| `errorType`, `errorMessage`, `errorStackTrace` | Full exception details |
| `sourceFile`, `sourceLine` | From AspectJ `SourceLocation` |
| `eventType` | `METHOD` or `SQL` |
| `slowPath`, `isOnCriticalPath` | Heuristic risk flags from collector |
| `contentionRisk`, `resourceLeakSuspicion`, `logicGapRisk` | Additional risk signals |

### ✅ SQL Query Tracing
- Custom JDBC proxy (`TracingDataSource` → `TracingConnection` → `TracingStatement`)
- Captures SQL text, bound parameters, and wall-clock execution time
- Slow query flag at ≥500ms threshold
- SQL spans appear as `eventType: SQL` nodes in the call tree
- `SqlTraceListener` feeds events into the same `InMemoryTraceCollector`

### ✅ Async Context Propagation
- `AsyncContextPropagator` + `traceAsyncExecutor` bean for `@Async` methods
- `TraceContextPropagator` for `CompletableFuture` chains
- `TaskDecorator` integration for Spring thread pool propagation

### ✅ Reactor Context Propagation (Infrastructure)
- `ReactorTraceContextConfig` captures `parentSpanId` and MDC at the point a reactive chain is created
- `wrap(Mono)` / `wrap(Flux)` methods restore trace context on each operator signal across thread hops
- `ReactorTraceContextAccessor` bean exposes the wrap helpers as a Spring-managed component
- Provides the scaffolding for full WebFlux support; end-to-end reactive tracing is not yet exercised by the demo app

### ✅ Distributed Tracing (Partial)
- `DistributedTraceInterceptor` propagates `X-Trace-Id` on outbound HTTP calls
- `RequestIdFilter` parses inbound W3C `traceparent` and `X-Trace-Id` headers
- `DistributedSpanMerger` merges remote span payloads into the local tree
- Cross-service span merging is partially implemented

---

## Backend: Analysis Engine

### ✅ In-Memory Trace Collector (`InMemoryTraceCollector`)
- Builds `CallTreeNode` trees using `spanId` / `parentSpanId` for stable linkage
- Computes critical path (longest duration branch) on each update
- Sets heuristic risk flags: `slowPath`, `contentionRisk`, `resourceLeakSuspicion`, `logicGapRisk`, `isOnCriticalPath`
- LRU eviction when `max-traces` is exceeded
- TTL-based background cleanup
- Configurable sampling: `all`, `slow` (>500ms), or percentage (e.g. `"10"`)

### ✅ Root-Cause Analysis (`TraceRootCauseAnalyzer`)
- `rootCauseHints` — human-readable diagnostic strings from execution patterns
- `nPlusOneWarnings` — detected when the same SQL query fires more than 2× per trace
- `anomalies` — statistical outliers vs. rolling aggregate baselines
- `warnings` — general slow-path and contention notices

### ✅ Statistical Metrics Dashboard (`InMemoryTraceCollector` + REST)
- Per-method aggregate stats: count, avg, p50, p95, p99, variance, error rate
- Served at `GET /traces/metrics/dashboard`
- Polled every 15 s by the frontend
- Anomaly list included in dashboard response

### ✅ Alert Engine (`TraceAlertService`)
- Rule-based alert firing with `severity: ERROR | WARN`
- Alert history accessible at `GET /traces/alerts` (optionally scoped to a request)
- Surfaced in the frontend header badge and Alert Rail

### ✅ Trace Diff
- `GET /traces/diff?baseRequestId=X&compareRequestId=Y`
- Returns: added methods, removed methods, top-8 timing deltas by magnitude

### ✅ Trace Search (`TraceSearchService`)
- `GET /traces/search?method=X&minDurationMs=Y&hasError=true&limit=50`
- Searchable by method name substring, duration floor, and error flag

### ✅ Trace Persistence & Share Links (`TracePersistenceService`)
- `POST /traces/{requestId}/persist` — saves to disk, returns a `sharePath`
- `GET /traces/history` — list of persisted trace summaries
- Shareable URL for sharing a specific trace with teammates

---

## Backend: Export & Integrations

### ✅ Export Endpoints
| Format | Endpoint |
|--------|----------|
| JSON | `GET /traces/{requestId}/export/json` |
| SVG | `GET /traces/{requestId}/export/svg` |
| PDF | `GET /traces/{requestId}/export/pdf` |
| OpenTelemetry OTLP | `GET /traces/{requestId}/export/otel` |

### ✅ Source Code Integration
- `GET /traces/source?className=X&lineNumber=Y&contextLines=N`
- `GET /traces/{requestId}/source?className=X&lineNumber=Y`
- Returns source snippet from classpath when debug info is available
- Frontend `CodePreview.jsx` renders the snippet inline with Java syntax highlighting (keywords, strings, comments, numbers), line numbers, and target-line highlighting

### ✅ Safe Replay Endpoint
- `POST /traces/{requestId}/replay`
- Returns replay instructions and trace structure — no arbitrary code execution

---

## Backend: Production Readiness

### ✅ Global Exception Handling
- `GlobalExceptionHandler` (`@RestControllerAdvice`) catches all unhandled exceptions from REST controllers
- Every error response includes `requestId` from MDC, enabling instant correlation with trace data
- Handles `Exception` (500), `IllegalArgumentException` (400), and `NullPointerException` (500 with "logic gap" annotation)
- Response body: `{ requestId, timestamp, status, error, message }`

### ✅ Memory Management
- Configurable `max-traces` with LRU eviction (default: 1000)
- Configurable `ttl-seconds` with background cleanup (default: 3600)

### ✅ Sampling
- `all` — capture every trace (development default)
- `slow` — only traces exceeding 500ms
- Percentage — e.g. `"10"` captures 10% of requests

### ✅ Sensitive Data Redaction (`SensitiveDataRedactor`)
- Pattern-based field matching: `password`, `token`, `secret`, `apiKey`, etc. (case-insensitive)
- Long alphanumeric/hex string detection (potential bearer tokens)
- Configurable via `trace.redaction.enabled`

### ✅ WebSocket Security
- `WebSocketAuthInterceptor` — shared-secret `?token=` handshake guard
- Disabled by default (`auth-token: none`) for zero-friction local dev
- HTTP 401 returned for unauthorized upgrade attempts
- Configurable CORS origins via `trace.websocket.allowed-origins`

### ✅ Auto-Reconnect (Frontend)
- Exponential backoff: 1 s → 2 s → 4 s → … capped at 30 s
- Transparent to the user — stream resumes automatically

---

## Frontend: Dashboard Shell

### ✅ KPI Summary Bar
- Four headline cards pinned between header and content: **Live Traces · Error Rate · Peak p99 · Active Alerts**
- Colour-coded thresholds (green / orange / red)
- Derived from `metricsReport` + live `requestStats` — zero extra API calls

### ✅ Sidebar Tab Navigation
- **Requests** tab — filterable request list with health badges and bookmarks
- **Search** tab — method name / min duration / errors-only filter + persisted history
- **Stats** tab — full method metrics table with sparkbars
- Active alert count shown at sidebar bottom regardless of active tab

### ✅ Per-Request Health Grade
- A–F score computed from: error count (−15/error), contention (−8/node), slow spans (−6/span), peak latency
- Coloured badge on every request card for instant triage

### ✅ Alert Notification Rail
- Collapsible banner at top of main panel when alerts are active
- Critical (ERROR) alerts: red border + pulsing dot
- Warning alerts: yellow border
- Each alert individually dismissible

### ✅ Events/sec Counter
- Rolling 10-second window of incoming WebSocket events
- Displayed next to the "Live" indicator in the header

### ✅ Bookmark Persistence
- Star toggle on each request card
- Bookmarked IDs written to `localStorage` — survive page reload

---

## Frontend: Visualizations

### ✅ Call Tree (`TraceTree.jsx`)
- D3 force-graph vertical layout
- Collapsible subtrees (click node ring to toggle)
- Method filter with live dimming of non-matching nodes
- Slow-path edge highlighting
- Error nodes in red with ring indicator
- Particle animation on the edge to the most recently received node

### ✅ Flame Graph (`FlameGraph.jsx`)
- Click-to-zoom into any frame; breadcrumb navigation to zoom out
- Hotspot ranking sidebar (top-5 frames by self time)
- Critical-path frames highlighted with a glow border
- Per-frame risk chips: ERR / SLOW / SQL / WAIT / LEAK
- Hover tooltip: inclusive time, self time, % of trace

### ✅ Thread Swimlane Timeline (`RequestTimeline.jsx`)
- One lane per thread, colour-coded spans: OK (green) · Slow (orange) · SQL (blue) · Contention (purple) · Error (red)
- Zoom slider 1×–20×, drag-to-pan
- Hover tooltip with method name, duration, start offset, flags
- Legend row below chart

### ✅ Node Detail Panel (`NodeDetailPanel.jsx`)
Four tabs per selected node:
1. **Info** — duration (colour-coded), CPU%, status, thread, thread state, source location, parent, duration bar vs. trace max
2. **Params / Return** — JSON viewer for arguments and return value; SQL text for SQL nodes
3. **Stack Trace** — full error stack trace with red highlighting
4. **SQL** — all SQL spans from the trace, each with timing chip; slow-query badge

### ✅ SQL Query Inspector (`SqlInspector.jsx`)
- Summary stats: total SQL spans, total SQL time, unique query count, N+1 risk count
- All queries grouped by normalized text
- N+1 badge when a query fires >2× in one trace
- SLOW badge when any execution of that query exceeded 500ms
- Per-call timing chips inside each group

### ✅ Comparison & Diff (`ComparisonSection.jsx`, `ComparisonView.jsx`, `OverlayTimeline.jsx`)
- Select any second request as "compare" target
- Side-by-side D3 tree with added (green) / removed (red) method highlighting
- Overlay timeline — base vs. compare on shared time axis
- Timing delta table: method name, +/− ms, colour-coded

### ✅ Inline Source Code Viewer (`CodePreview.jsx`)
- Triggered from any node's Info tab in `NodeDetailPanel` when `sourceFile` + `sourceLine` are present
- Fetches `GET /traces/source` with `contextLines: 7` to show the surrounding code
- Java syntax highlighting: keywords, string literals, comments, numeric literals
- Target line highlighted with a distinct background; line numbers rendered in gutter
- HTML-escapes raw source before injecting `<span>` wrappers — prevents XSS from Java generics (`List<String>`) and other angle-bracket syntax

### ✅ Metrics Sparkbars (`MetricsDashboard.jsx`)
- Three-layer latency bar per method row: p50 (green) → p95 (orange) → p99 (red)
- All bars normalized against the slowest p99 across all methods
- Hot method names (p99 > 500ms) in orange bold
- Anomaly callout box when anomalies are present

### ✅ Export Dropdown (`ExportDropdown.jsx`)
- Single "⬇ Export" button replacing four separate links
- JSON / SVG / PDF / OTEL download links
- "Generate share link" with inline copy-to-clipboard
- Closes on outside click

### ✅ Empty State
- Feature overview grid (6 cards): Live Call Tree · Flame Graph · Statistical Metrics · Thread Timeline · Root-Cause Analysis · Trace Diff
- Two sample request buttons with live loading / success / error feedback

---

## Testing & Quality

### ✅ Backend Tests (JUnit)
- Call tree building: span ID linkage, out-of-order events, orphan spans
- Diff logic: added/removed methods, timing deltas, edge cases
- Redaction: password/token/PII patterns, long string detection, non-string preservation
- Concurrency: parallel event ingestion, LRU eviction under load, WS broadcast under concurrent reads
- OTel export service: OTLP JSON structure validation
- Search service: method filter, duration filter, error filter

### ✅ Frontend Tests (Vitest, 17 tests)
- `computeMetrics` — slow-path selection, node counting, maxExecution tracking
- `flattenEvents` — DFS ordering, ROOT node exclusion
- `extractClassNameFromMethod` — FQN parsing, edge cases
- `buildTracesFromEvents` — span linkage, orphan handling, multi-request isolation

### ✅ CI/CD Pipeline (GitHub Actions)
- Backend: `./gradlew test` + build on every push/PR
- Frontend: `npm run build` on every push/PR
- Test result and build artifact uploads

---

## Known Limitations

| Area | Status |
|------|--------|
| WebFlux / Reactor Context propagation | Not implemented |
| Cross-service distributed span merging | Partial — infrastructure exists, merge logic incomplete |
| Persistent storage (DB / object store) | File-based only; single-instance |
| Alert acknowledgement API | Not implemented — alerts accumulate until page refresh |
| Time-series latency endpoint | Not implemented — metrics API returns aggregate snapshot only |
| Accessibility (keyboard nav, ARIA) | Minimal — not hardened for screen readers |
