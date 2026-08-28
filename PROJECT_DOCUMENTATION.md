# Live Backend Execution Trace Visualizer

**Companion docs**

- [Complete Feature List](docs/FEATURES.md) — comprehensive list of all implemented features
- [Architecture diagrams (Mermaid)](docs/ARCHITECTURE.md) — system context, sequences, component map, frontend pipeline
- [Engineering onboarding & handoff](docs/ENGINEERING_ONBOARDING.md) — sequences, glossary, ops notes, extension playbook
- [Portfolio / resume narrative](docs/PORTFOLIO_RESUME_VERSION.md) — elevator pitch, resume bullets, interview story

---

## 1) Project Overview

This project is a full-stack, real-time execution tracing system for a Spring Boot backend. It instruments method calls at runtime and streams trace events to a React frontend for live visualization and analysis.

At its current stage, it supports:

- Runtime tracing of controller/service/repository calls with **stable span IDs**
- Parent-child call graph modeling with **UUID-based span linkage**
- Per-request trace grouping with correlation IDs
- Real-time WebSocket streaming with **configurable URLs**
- Interactive tree and flame-style visualizations
- Cross-request comparison (visual + analytical diff)
- Error-aware trace nodes with stack trace details
- Timeline exploration with zoom/pan
- **CPU time tracking** via ThreadMXBean
- **Sensitive data redaction** (passwords, tokens, PII)
- **Configurable sampling** (all, slow, percentage-based)
- **Memory management** (TTL, max traces, LRU eviction)
- **SQL query tracing** with slow query detection
- **Comprehensive test suite** with CI/CD pipeline

The repository is currently centered on two active modules:

- `instrumented-app` (backend + trace emitter + in-memory trace store + analysis endpoints)
- `frontend` (real-time UI and analysis views)

---

## 2) High-Level Architecture

### Backend (`instrumented-app`)

- Spring Boot application with AOP tracing
- `OncePerRequestFilter` assigns request-scoped correlation id (`requestId`)
- `TraceAspect` intercepts method execution and builds `TraceEvent` objects
- Events are:
  - printed as JSON (`ConsoleTraceEventPublisher`)
  - ingested into in-memory call tree (`InMemoryTraceCollector`)
  - broadcast live to frontend via WebSocket (`TraceWebSocketHandler`)
- REST endpoints expose trace replay, analysis, source snippet lookup, and trace diff

### Frontend (`frontend`)

- React + D3 single-page app
- Opens WebSocket connection to backend (`/ws/traces`)
- Groups incoming events per request and reconstructs trees
- Supports:
  - Tree view
  - Flame graph view
  - Per-request timeline
  - Compare mode with analytical diff panel
  - Overlay timeline for divergence preview

---

## 3) Backend Details

## 3.1 Runtime Tracing Pipeline

1. Request enters backend.
2. `RequestIdFilter` creates UUID and stores it in MDC.
3. Traced methods execute through `TraceAspect` AOP proxy.
4. `TraceAspect`:
   - computes duration
   - resolves parent method from `TraceStack`
   - captures params/return
   - captures error info (if thrown)
   - captures source/thread metadata
   - emits `TraceEvent`
5. Event is:
   - logged to console (JSON)
   - appended to in-memory call tree
   - pushed to all connected WebSocket sessions

## 3.2 Core Backend Classes

- `RequestIdFilter`
  - Assigns `requestId` per HTTP request
  - Clears MDC + trace stack at request end

- `TraceStack` + `TraceContext`
  - ThreadLocal stack to preserve parent-child relationships

- `TraceAspect`
  - Intercepts:
    - `@RestController`
    - `@Service`
    - `@Repository`
  - Creates `TraceEvent` with:
    - `eventId`, `spanId`, `parentSpanId` (stable UUID-based identifiers)
    - `requestId`, `threadId`, `timestamp`
    - `method`, `params`, `returnValue`
    - `executionTimeMs`, `parentMethod` (fallback for backward compatibility)
    - `sourceFile`, `sourceLine` (from AspectJ SourceLocation)
    - `status`, `errorType`, `errorMessage`, `errorStackTrace`
    - `threadName`, `threadCpuTimeMs` (actual CPU time via ThreadMXBean), `threadState`
    - `eventType` (METHOD, SQL, etc.)

- `InMemoryTraceCollector`
  - Builds request-scoped `CallTreeNode` trees using **spanId/parentSpanId** for stable linkage
  - Adds heuristic risk flags (slow/resource/logic/contention hints)
  - Computes critical path on each update
  - **Memory management**:
    - Configurable max traces (LRU eviction)
    - TTL-based cleanup with background thread
  - **Sampling support**:
    - "all", "slow" (>500ms), or percentage-based
  - Supports:
    - `analyzeTrace(requestId)` - comprehensive analysis with warnings
    - `diffTraces(baseRequestId, compareRequestId)` - added/removed methods + timing deltas

- `TraceReplayController`
  - Exposes trace and analysis APIs (listed below)

- `TraceWebSocketHandler`
  - Manages active socket sessions
  - Serializes `TraceEvent` and broadcasts to all clients
  - **Configurable CORS origins** via `trace.websocket.allowed-origins`

- `SensitiveDataRedactor`
  - Pattern-based redaction of sensitive fields
  - Detects passwords, tokens, API keys, PII
  - Long alphanumeric/hex string detection
  - Configurable via `trace.redaction.enabled`

- `SqlTraceListener` + JDBC wrappers
  - Intercepts SQL queries via custom DataSource
  - Captures query text, execution time, parameters
  - Slow query detection (>500ms threshold)

## 3.3 Backend Demo Domain Flow

Current demo endpoint `GET /users/{id}` triggers a richer nested call flow:

- `UserController.getUser`
  - `UserService.getUser`
    - `ValidationService.validateUser`
      - `ValidationService.basicChecks`
      - `RiskAssessmentService.assessRisk`
        - `RiskAssessmentService.callExternalRiskEngine`
        - `RiskAssessmentService.parseRiskResponse`
    - `UserRepository.findUserById`
    - `ProfileEnrichmentService.enrichProfile`
      - `ProfileEnrichmentService.loadPreferences`
      - `ProfileEnrichmentService.computeRecommendations`

This produces a non-trivial call tree for visualization/testing.

## 3.4 Backend REST APIs

Base path: `/traces`

- `GET /traces/{requestId}`
  - Returns text tree representation

- `GET /traces/{requestId}/json`
  - Returns full `CallTreeNode` JSON

- `GET /traces/{requestId}/analysis`
  - Returns `TraceAnalysisReport`
  - Includes counts and warning summaries

- `GET /traces/diff?baseRequestId=...&compareRequestId=...`
  - Returns `TraceDiffReport`
  - Includes:
    - added methods
    - removed methods
    - top timing deltas

- `GET /traces/source?className=...&lineNumber=...&contextLines=...`
  - Attempts source snippet lookup around a line

- `GET /traces/{requestId}/source?className=...&lineNumber=...&contextLines=...`
  - Request-scoped source snippet lookup

- `POST /traces/{requestId}/replay`
  - **Safe replay endpoint** - returns replay instructions without executing arbitrary code
  - Provides trace structure and manual replay guidance

Additional application endpoint:

- `GET /users/{id}`
  - Generates trace events and returns `User-{id}`

## 3.5 WebSocket Endpoint

- Default: `ws://localhost:8080/ws/traces`
- **Configurable via frontend `.env` file**:
  - `VITE_WS_URL` - explicit WebSocket URL
  - `VITE_API_URL` - API base URL (WebSocket URL derived)
- Sends serialized `TraceEvent` messages in real time
- **CORS origins configurable** via `application.yml`

## 3.6 Configuration

All trace features are configurable via `application.yml`:

```yaml
trace:
  enabled: true
  max-traces: 1000          # LRU eviction limit
  ttl-seconds: 3600         # 1 hour retention
  sampling: all             # "all", "slow", or percentage like "10"
  redaction:
    enabled: true           # Redact sensitive data
  websocket:
    allowed-origins: "http://localhost:3000,http://localhost:5173"
```

**Port Configuration (Single Source of Truth)**:
- Backend: `8080` (Spring Boot default)
- Frontend: `5173` (Vite default, configurable via `VITE_PORT`)

---

## 4) Frontend Details

## 4.1 Data and State Model

The frontend does not trust arrival order for parent insertion. It stores raw events by request and rebuilds trees:

- `eventsByRequest: { [requestId]: TraceEvent[] }`
- `traces` is derived from `eventsByRequest`
- Selected request and compare request are independent view controls

This approach avoids child-before-parent insertion loss during streaming.

## 4.2 Main UI Features (`App.jsx`)

- Real-time stream controls
  - Pause/resume live ingestion
  - Clear all traces

- Request navigation
  - Active request list
  - Request search
  - Request bookmarking (star toggle)

- View modes
  - Tree
  - Flame graph

- Comparison features
  - Choose compare request
  - Side-by-side visualization panels
  - Analytical diff summary
  - Overlay timeline (base vs compare)

- Node details panel
  - Method, duration, timestamp, thread, parent
  - Params/return JSON
  - Error status/type/message/stack trace when present

## 4.3 Visualization Components

- `TraceTree.jsx`
  - Vertical centered tree layout using D3
  - Collapsible subtrees
  - Method filter dimming
  - Slow path highlighting
  - Error nodes highlighted in red
  - Compact visible labels

- `FlameGraph.jsx`
  - Horizontal stacked bars by depth
  - Width scaled by execution time
  - Error-aware coloring
  - In-bar labels when space allows

- `RequestTimeline.jsx`
  - Request call bars on time axis
  - Zoom slider (1x to 10x)
  - Drag-to-pan window
  - Visible range indicators

- `OverlayTimeline.jsx`
  - Base/compare normalized tracks
  - Side-by-side overlay bars
  - Simple divergence estimate

- `ComparisonView.jsx`
  - Legacy/alternate compare view component exists in codebase
  - Not currently wired into `App.jsx`

## 4.4 Frontend Service Layer

- `services/websocket.js`
  - Handles open/message/close callbacks
  - Parses each event JSON and forwards to app state

---

## 5) Implemented Feature Inventory (Current State)

## 5.1 Core Tracing

- Request-scoped correlation id
- Thread-local parent chain tracking
- AOP interception at controller/service/repository layers
- Method params, return value, duration, parent method capture
- WebSocket event broadcast
- Console JSON trace output

## 5.2 Error and Diagnostics

- `SUCCESS/ERROR` event status
- Error type + message + stack trace propagation
- Error node highlighting in UI
- Error details in selected-node panel

## 5.3 Analysis Features

- Critical path marking in backend call tree
- Basic trace analysis report with warnings
- Analytical diff between two request traces:
  - added methods
  - removed methods
  - timing deltas

## 5.4 Visualization/UX

- Vertical tree with clear root positioning
- Flame graph mode toggle
- Timeline with zoom + drag
- Compare request flow
- Overlay timeline divergence view
- Method filtering
- Request search and bookmarks

---

## 6) Configuration and Runtime

## 6.1 Backend

- Java 17
- Spring Boot 3.2.1
- Main dependencies:
  - web, aop, websocket, actuator
  - Jackson JSR310 module
- Config:
  - `trace.enabled: true` in `application.yml`

## 6.2 Frontend

- React 19 + Vite + D3
- Dev server is configured for port `3000` in `vite.config.js`

---

## 7) Current Known Gaps / Caveats

- Parent linkage uses method name matching (`parentMethod`) rather than stable span IDs, which can be ambiguous with repeated method names.
- `threadCpuTimeMs` is currently set to `0L` in `TraceAspect` (placeholder metric).
- `SourceCodeHelper` source lookup depends on source availability on classpath; can return `null`.
- Replay endpoint is currently placeholder text (not reflective re-execution).
- `shared-model` and `trace-collector` are present but not implemented as decoupled runtime modules yet.
- `README.md` mentions port `5173`, while `vite.config.js` sets frontend to `3000`.

---

## 8) Version 2 Progress Mapping (from `Version2.md`)

### Implemented / Partially Implemented

- Error and exception flow visualization: implemented
- Analytical trace diff engine: implemented (MVP)
- Flame graph mode: implemented
- Timeline zoom + drag: implemented
- Cross-request overlay timeline: implemented (MVP divergence heuristic)

### Recently Implemented (v2 completion)

- **Distributed tracing**: inbound `X-Trace-Id` / W3C `traceparent` parsing in `RequestIdFilter`; outbound propagation via `DistributedTraceInterceptor`
- **Async context propagation**: `AsyncContextPropagator` + `traceAsyncExecutor` bean; `TraceContextPropagator` for `CompletableFuture`
- **SQL tracing + N+1 detection**: JDBC wrappers + `SqlTraceListener`; N+1 heuristics in `TraceRootCauseAnalyzer`
- **Persistence/export**: `TracePersistenceService` (file storage, share links, retention); export endpoints for JSON/SVG/PDF
- **Metrics dashboard**: `GET /traces/metrics/dashboard` with p50/p95/p99, variance, error rate; `MetricsDashboard` UI component
- **Root-cause + anomalies**: extended `TraceAnalysisReport` with `rootCauseHints`, `nPlusOneWarnings`, `anomalies`
- **Stable span linkage**: `spanId`/`parentSpanId` in backend + frontend tree builder
- **Backend-driven compare diff**: UI fetches `GET /traces/diff` instead of client-side diff

---

## 9) Suggested Next Engineering Steps

1. Add Reactor/WebFlux `Context` propagation for fully reactive stacks.
2. Replace file-based persistence with object storage / DB for multi-instance deployments.
3. Add OpenTelemetry exporter bridge for interoperability with standard APM tools.
4. Harden PDF export (rich layout) and add trace search/indexing over persisted archives.
5. Add auth on share links and export endpoints for production hardening.

---

## 10) Quick Run Reference

Backend:

```bash
cd instrumented-app
./gradlew bootRun
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Trigger traces:

```bash
curl http://localhost:8080/users/2
```

