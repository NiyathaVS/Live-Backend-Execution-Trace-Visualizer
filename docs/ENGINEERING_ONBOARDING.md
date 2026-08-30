# Engineering Onboarding & Handoff

Audience: engineers joining the project or reviewing it for maintenance, extension, or production hardening.

---

## 1. What This System Does (One Paragraph)

A **Spring Boot** service is instrumented with **Spring AOP** so that each traced method call produces a **`TraceEvent`** (method, timing, CPU time, params, return, errors, span IDs). Events are logged, stored in an **in-memory call tree** per `requestId`, and streamed live over **WebSocket** to a **React + D3 professional observability dashboard**. The dashboard displays a KPI summary bar, interactive call trees, flame graphs, thread swimlane timelines, SQL query inspection, statistical metrics with sparkbars, root-cause hints, alert notifications, cross-request diffs, and multi-format export.

---

## 2. Repository Layout

| Path | Role |
|------|------|
| `instrumented-app/` | Runnable Spring Boot app: demo API + tracing + REST + WebSocket |
| `frontend/` | Vite + React dashboard with configurable WebSocket URL |
| `PROJECT_DOCUMENTATION.md` | Full technical inventory, API reference, architecture |
| `docs/FEATURES.md` | Complete feature checklist |
| `docs/ARCHITECTURE.md` | Mermaid diagrams: context, sequence, components, frontend pipeline |
| `docs/PORTFOLIO_RESUME_VERSION.md` | Resume narrative, interview talking points |
| `.github/workflows/ci.yml` | CI/CD pipeline: backend tests + frontend build |
| `shared-model/`, `trace-collector/` | Present in tree; **not** active multi-module pipeline in current code |

---

## 3. End-to-End Sequence (Happy Path)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant F as RequestIdFilter
    participant H as Spring MVC + beans
    participant A as TraceAspect
    participant E as TraceEvent
    participant Col as InMemoryTraceCollector
    participant Alert as TraceAlertService
    participant W as TraceWebSocketHandler
    participant U as React Dashboard

    C->>F: GET /users/2
    F->>F: UUID → MDC["requestId"]
    F->>H: dispatch

    Note over H,A: Each proxied method entry/exit wrapped by @Around AOP

    H->>A: around advice (push spanId, proceed, pop)
    A->>E: build event (parent from TraceStack, CPU, source, errors)
    A->>Col: addEvent (tree + heuristics + critical path + sampling)
    Col->>Alert: evaluate rules → fire alerts if triggered
    A->>W: broadcast JSON

    W-->>U: WebSocket message
    U->>U: append event; rebuild tree; render
```

---

## 4. Key Backend Contracts

### 4.1 `TraceEvent` (Wire Format to UI)

Emitted as JSON over WebSocket. Critical fields:

**Identity & linkage:**
- `eventId` — UUID per event
- `spanId` — UUID per method invocation; **primary tree linkage key**
- `parentSpanId` — UUID of parent; used by `buildTracesFromEvents` in frontend
- `requestId` — HTTP request correlation ID

**Call data:**
- `method` / `methodName` — fully-qualified method signature
- `params` / `returnValue` — captured with redaction applied
- `executionTimeMs` — wall-clock duration
- `threadCpuTimeMs` — actual CPU time via `ThreadMXBean`
- `threadName` / `threadState` — OS thread name + JVM state
- `timestamp` — ISO-8601 invocation start
- `eventType` — `METHOD` or `SQL`

**Risk flags (set by `InMemoryTraceCollector`):**
- `slowPath`, `isOnCriticalPath`, `contentionRisk`, `resourceLeakSuspicion`, `logicGapRisk`

**Error details:**
- `status` (`SUCCESS` / `ERROR`), `errorType`, `errorMessage`, `errorStackTrace`

**SQL-specific:**
- `sql` — query text
- `slowQuery` — boolean (≥500ms)

### 4.2 In-Memory Tree (`CallTreeNode`)

Built by `InMemoryTraceCollector` using `spanId`/`parentSpanId` for stable linkage. Used by:
- `GET /traces/{requestId}/json`
- `analyzeTrace`, `diffTraces`, metrics, search, alerts

Flags set per node: `slowPath`, `hasError`, `isOnCriticalPath`, `contentionRisk`, `resourceLeakSuspicion`, `logicGapRisk` — these are **best-effort heuristics**, not formal static analysis.

**Production features:**
- **Sampling**: `all`, `slow` (>500ms), percentage (e.g. `"10"`)
- **LRU eviction**: drops oldest trace when `max-traces` exceeded
- **TTL cleanup**: background thread removes traces older than `ttl-seconds`

### 4.3 Full REST Surface

See [PROJECT_DOCUMENTATION.md §3.4](../PROJECT_DOCUMENTATION.md) for the complete table. Most-used endpoints during development:

| Endpoint | When to use |
|----------|-------------|
| `/traces/{id}/json` | Inspect raw tree shape |
| `/traces/{id}/analysis` | Check hints, N+1, anomalies |
| `/traces/metrics/dashboard` | See p50/p95/p99 per method |
| `/traces/search` | Find traces matching a criterion |
| `/traces/alerts` | Check active alert list |
| `/traces/diff` | Compare two traces |

---

## 5. Frontend Mental Model

### 5.1 Why `eventsByRequest` Exists

WebSocket events can arrive **out of order** relative to ideal parent insertion. The UI stores **raw events per request** and `buildTracesFromEvents` rebuilds the full tree (using `spanId`/`parentSpanId`) so every parent node exists before children attach. Never modify this pattern without understanding the ordering guarantee it provides.

### 5.2 Hook Architecture

Three custom hooks own all server interaction — `App.jsx` just receives data and passes it to components:

- **`useTraceStream`** — WebSocket lifecycle, `eventsByRequest` state, pause/resume, `latestEvent` for animations
- **`useSearchAndMetrics`** — polls `/metrics/dashboard`, `/alerts`, `/history`; debounces `/search` on criteria changes
- **`useComparisonState`** — fetches `/traces/diff` when compare request is selected

### 5.3 Component Responsibilities (Quick Map)

| Component | One-line role |
|-----------|---------------|
| `KpiBar` | 4 headline health cards (Traces / Error Rate / p99 / Alerts) |
| `AlertRail` | Collapsible alert banner with per-alert dismiss |
| `ExportDropdown` | Single menu replacing 4 export links + share link |
| `TraceTree` | D3 force-graph; collapse, filter, particle animation |
| `FlameGraph` | Click-to-zoom with hotspot sidebar and risk chips |
| `RequestTimeline` | Thread swimlane; zoom/pan; colour-coded spans |
| `NodeDetailPanel` | Info / Params / Stack Trace / SQL tabs per node |
| `CodePreview` | Inline Java source viewer; shown from NodeDetailPanel Info tab when `sourceFile`/`sourceLine` are present; fetches `GET /traces/source`; syntax-highlights Java |
| `SqlInspector` | N+1 detection; queries grouped; per-call timing chips |
| `MetricsDashboard` | p50/p95/p99 sparkbars + anomaly callout |
| `ComparisonSection` | Diff table + side-by-side trees + overlay timeline |
| `AnalysisBanner` | Root-cause hints, N+1 warnings, anomalies above fold |

### 5.4 Health Grade Computation

Per-request A–F score in `App.jsx` (`computeHealthGrade`):

```
score = 100
- min(errors × 15, 40)
- min(contention × 8, 20)
- min(slowSpans × 6, 20)
- 15 if totalMs > 2000, else 8 if totalMs > 500

A ≥ 90 · B ≥ 75 · C ≥ 60 · D ≥ 40 · F < 40
```

---

## 6. Local Development

### Backend

```bash
cd instrumented-app
./gradlew bootRun
# Default: http://localhost:8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Default: http://localhost:5173
```

### WebSocket URL & Auth

1. Copy `frontend/.env.example` to `frontend/.env`
2. Set either:
   ```bash
   VITE_API_URL=http://localhost:8080        # WebSocket URL derived automatically
   # or
   VITE_WS_URL=ws://localhost:8080/ws/traces # Explicit WebSocket URL
   ```
3. Optional auth (must match backend `trace.websocket.auth-token`):
   ```bash
   VITE_WS_TOKEN=your-strong-secret
   ```

Default fallback: `ws://localhost:8080/ws/traces`. Auth is disabled by default.

**Auto-reconnect** — exponential backoff 1 s → 2 s → 4 s → … capped at 30 s.

### Trigger Sample Traces

```bash
curl http://localhost:8080/users/2
curl http://localhost:8080/orders/1001/fulfillment
```

Or use the sample buttons in the frontend empty state.

---

## 7. Configuration & Production Readiness

### Backend (`application.yml`)

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
    auth-token: "none"      # "none" = auth disabled; set a secret to protect the WS endpoint
```

**Production recommendations:**
- `sampling: slow` or percentage — reduce overhead
- `max-traces: 500`, `ttl-seconds: 1800` — lower memory footprint
- `redaction.enabled: true` — always on in production
- `auth-token` — set to a strong random string; supply `VITE_WS_TOKEN` on the frontend
- `allowed-origins` — restrict to your actual frontend domain(s)

### Security Checklist

| Control | Status | Notes |
|---------|--------|-------|
| CORS origins | ✅ Configurable | Must be set for production |
| PII redaction | ✅ On by default | Detects passwords, tokens, API keys, long hex/base64 |
| WebSocket auth | ✅ Opt-in | `HandshakeInterceptor` rejects wrong/missing token with 401 |
| Memory bounds | ✅ LRU + TTL | Prevents unbounded growth |
| Replay safety | ✅ No execution | Replay endpoint returns instructions only |
| Async propagation | ⚠️ Partial | `@Async` / `CompletableFuture` supported; WebFlux not yet |

---

## 8. Testing

### Backend

```bash
cd instrumented-app && ./gradlew test
```

Covers: call tree building, span IDs, diff logic, redaction, concurrency, OTel export, search.

### Frontend

```bash
cd frontend && npm test
```

17 Vitest tests for all `traceUtils.js` functions.

### Build Validation

```bash
cd frontend && npm run build
```

CI runs all of the above automatically on every push and PR.

---

## 9. What's Been Built (Chronological Summary)

### GlobalExceptionHandler
- `@RestControllerAdvice` in `com.example.tracer.config`
- Catches `Exception`, `IllegalArgumentException`, and `NullPointerException` before Spring's default error handler
- All responses include `requestId` from MDC — lets you correlate a 500 in the browser with the exact trace that caused it
- Does **not** catch errors from the WebSocket handler (that path bypasses MVC)

### ReactorTraceContextConfig / ReactorTraceContextAccessor
- `ReactorTraceContextConfig.captureContext()` snapshots the current `TraceStack` parent + MDC map into a Reactor `Context`
- `wrap(Mono)` / `wrap(Flux)` writes that context into the chain and restores it before each operator signal, then clears ThreadLocals on `doFinally`
- `ReactorTraceContextAccessor` is a Spring `@Component` wrapping the static helpers — inject it or call `ReactorTraceContextAccessor.withTraceContext(mono)` from any bean
- **Not yet wired into the demo app.** Intended entry point for future WebFlux endpoint tracing

### Round 1 — Core tracing infrastructure
Stable span IDs, sampling, LRU+TTL memory management, CPU time (ThreadMXBean), AspectJ source metadata, PII redaction, configurable WebSocket URL, CORS configuration, SQL tracing, safe replay endpoint, backend test suite, GitHub Actions CI.

### Round 2 — Observability depth
WebSocket auto-reconnect (exponential backoff), Lombok `@Builder` for `TraceEvent`, `traceUtils.js` extraction, 17 Vitest frontend tests, WebSocket shared-secret auth, distributed trace header propagation, async context propagation, N+1 detection, OTel export, persistence + share links, metrics dashboard (p50/p95/p99), root-cause analyzer, alert engine, trace search, trace history.

### Round 3 — Professional dashboard UI
KPI Summary Bar (4 headline health cards), sidebar tab navigation (Requests / Search / Stats), per-request health grades (A–F), Alert Notification Rail (collapsible, per-alert dismiss, severity-coded), method metrics sparkbars (3-layer p50/p95/p99 bars), Export Dropdown (JSON/SVG/PDF/OTEL/Share in one menu), SQL Query Inspector (N+1 grouping, per-call timing chips), SQL tab in NodeDetailPanel, bookmark persistence to `localStorage`, events/sec rolling counter in header, full empty state with 6-card feature overview.

---

## 10. Known Gaps

| Area | Notes |
|------|-------|
| WebFlux / Reactor | Not implemented |
| Cross-service span merging | Infrastructure exists; merge logic incomplete |
| File-based persistence | Single-instance only; no DB/object storage |
| Alert acknowledgement API | Alerts accumulate until page refresh |
| Time-series latency | Metrics endpoint returns aggregate snapshot only |
| Accessibility | Minimal; not hardened for screen readers or keyboard-only navigation |

---

## 11. Extension Playbook

### Add a new REST endpoint

1. Add handler to `TraceReplayController` or a new `@RestController`
2. Call into `InMemoryTraceCollector` for trace data
3. Add client function to `frontend/src/services/traceApi.js`
4. Wire into the relevant hook (`useSearchAndMetrics` for polling, `useComparisonState` for diff-style)

### Add a new frontend component

1. Create `frontend/src/components/MyComponent.jsx`
2. Use `COLORS` from `../theme.jsx` for consistent styling
3. Import and place in `App.jsx`
4. No CSS files needed — all styles are inline (exception: `CodePreview.jsx` uses `CodePreview.css` for its scoped syntax-highlight styles)

### Add a new error response field

1. Add the field to the `errorResponse` map in `GlobalExceptionHandler`
2. If it requires request-scoped data (e.g. current trace ID), read it from MDC or `TraceStack` — both are available in the handler thread
3. No frontend changes needed unless you want to display the field

### Add a new risk flag

1. Compute the flag in `InMemoryTraceCollector` and set it on `CallTreeNode`
2. Add the field to `TraceEvent` builder
3. Add a new `Badge` entry in `RiskBadges` in `theme.jsx`
4. Colour-code it in `TraceTree.jsx` (`nodeFill`, `nodeRingColor`) and `RequestTimeline.jsx` (`spanColor`)

---

## 12. Glossary

| Term | Meaning |
|------|---------|
| `requestId` | UUID per HTTP request; carried in MDC and every `TraceEvent` |
| `spanId` | UUID per method invocation; primary tree linkage identifier |
| `parentSpanId` | UUID of parent span; enables reliable parent-child tree construction |
| `TraceStack` | ThreadLocal deque mirroring traced call depth for parent resolution |
| `TraceEvent` | Immutable record of one method invocation; built via Lombok `@Builder` |
| Critical path | Longest cumulative duration path in collector's tree |
| Flame graph | Time-width stacked visualization; click-to-zoom; hotspot ranking |
| Sampling | `all` / `slow` (>500ms) / percentage — selective trace capture |
| Redaction | Automatic removal of sensitive data from params/return values |
| TTL | Time-to-live — automatic cleanup of traces older than configured duration |
| LRU eviction | Least-recently-used removal when max trace count exceeded |
| WS auth token | Shared secret checked by `WebSocketAuthInterceptor` on handshake |
| Health grade | A–F score computed per request from errors, latency, contention |
| KPI bar | Four headline health cards pinned below the dashboard header |
| Alert rail | Collapsible notification banner at top of main panel |
| Sparkbar | Three-layer latency bar (p50/p95/p99) in the metrics stats table |
| `traceUtils.js` | Pure JS module — `computeMetrics`, `flattenEvents`, `buildTracesFromEvents`, `extractClassNameFromMethod` |

---

## 13. Diagram Index

| Diagram | Location |
|---------|----------|
| System context | [ARCHITECTURE.md §1](./ARCHITECTURE.md#1-system-context) |
| Request trace pipeline | [ARCHITECTURE.md §2](./ARCHITECTURE.md#2-request-scoped-trace-pipeline) |
| Backend component map | [ARCHITECTURE.md §3](./ARCHITECTURE.md#3-backend-component-map) |
| Frontend data flow | [ARCHITECTURE.md §4](./ARCHITECTURE.md#4-frontend-data-flow) |
| Frontend component tree | [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-frontend-component-tree) |
| Local deployment | [ARCHITECTURE.md §6](./ARCHITECTURE.md#6-deployment-view-local-dev) |

---

## 14. Related Docs

| Document | Contents |
|----------|----------|
| [PROJECT_DOCUMENTATION.md](../PROJECT_DOCUMENTATION.md) | Full technical inventory, component reference |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete REST + WebSocket contract |
| [FEATURES.md](./FEATURES.md) | Full feature checklist |
| [PORTFOLIO_RESUME_VERSION.md](./PORTFOLIO_RESUME_VERSION.md) | Resume bullets and interview talking points |
| [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md) | Chronological build history |
