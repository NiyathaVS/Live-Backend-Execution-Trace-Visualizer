# Engineering onboarding & handoff

Audience: engineers joining the project or reviewing it for maintenance, extension, or production hardening.

---

## 1. What this system does (one paragraph)

A **Spring Boot** service is instrumented with **Spring AOP** so that each traced method call produces a **`TraceEvent`** (method, timing, params, return, parent link, errors). Events are **logged**, stored in an **in-memory call tree** per `requestId`, and **streamed live** over **WebSockets** to a **React + D3** UI that reconstructs call trees, timelines, flame-style views, and compare/diff summaries.

---

## 2. Repository layout (what matters today)

| Path | Role |
|------|------|
| `instrumented-app/` | Runnable Spring Boot app: demo API + tracing + REST + WS |
| `frontend/` | Vite + React UI with configurable WebSocket URL |
| `PROJECT_DOCUMENTATION.md` | Full feature and API inventory |
| `docs/FEATURES.md` | **Complete feature list with all capabilities** |
| `docs/ARCHITECTURE.md` | Diagrams (Mermaid): context, sequence, components |
| `docs/PORTFOLIO_RESUME_VERSION.md` | Short narrative for resumes / portfolio |
| `.github/workflows/ci.yml` | **CI/CD pipeline for automated testing** |
| `shared-model/`, `trace-collector/` | Present in tree; **not** active multi-module pipeline in current code |

---

## 3. End-to-end sequence (happy path)

This matches runtime behavior for a typical `GET /users/{id}`.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant F as RequestIdFilter
    participant H as Spring MVC + beans
    participant A as TraceAspect
    participant E as TraceEvent
    participant Col as InMemoryTraceCollector
    participant W as TraceWebSocketHandler
    participant U as React App

    C->>F: GET /users/2
    F->>F: UUID → MDC["requestId"]
    F->>H: dispatch

    Note over H,A: Each proxied method entry/exit wrapped by AOP

    H->>A: around advice (push stack, proceed, pop)
    A->>E: build event (parent from TraceStack)
    A->>Col: addEvent (tree + heuristics + critical path)
    A->>W: broadcast JSON

    W-->>U: WebSocket message
    U->>U: append event; rebuild tree; render
```

---

## 4. Key backend contracts

### 4.1 `TraceEvent` (wire format to UI)

Emitted as JSON over WebSocket and used by the UI as plain objects. Important fields:

- **Identity**: `eventId`, `requestId`, **`spanId`**, **`parentSpanId`** (UUID-based stable identifiers)
- **Call graph**: `method`, `parentMethod` (fallback for backward compatibility)
  - **Primary linkage**: Uses `spanId`/`parentSpanId` for stable parent-child relationships
  - **Fallback**: `parentMethod` string matching for legacy support
- **Timing**: `timestamp`, `executionTimeMs`
- **Payload**: `params`, `returnValue` (with **optional redaction** for sensitive data)
- **Errors**: `status` (`SUCCESS` / `ERROR`), `errorType`, `errorMessage`, `errorStackTrace`
- **Diagnostics**: `sourceFile`, `sourceLine` (from AspectJ SourceLocation), `threadName`, `threadState`, **`threadCpuTimeMs`** (actual CPU time via ThreadMXBean)
- **Event type**: `eventType` (METHOD, SQL, etc.)

### 4.2 In-memory tree (`CallTreeNode`)

Used by:

- `GET /traces/{requestId}/json`
- `analyzeTrace`, `diffTraces`

Collector also sets flags like `slowPath`, `hasError`, `isOnCriticalPath`, and heuristic "risk" booleans—some are **best-effort string heuristics**, not formal static analysis.

**New in current version**:
- **Memory management**: Configurable max traces (LRU eviction) + TTL-based cleanup
- **Sampling**: "all", "slow" (>500ms), or percentage-based (e.g., "10" for 10%)
- **Span-based linkage**: Uses `spanId`/`parentSpanId` for reliable tree construction

### 4.3 REST surface (`TraceReplayController`)

Documented in `PROJECT_DOCUMENTATION.md`. Onboarding tip: use **`/traces/{id}/json`** for debugging tree shape; use **`/analysis`** for aggregated warnings.

---

## 5. Frontend mental model

### 5.1 Why `eventsByRequest` exists

WebSocket events can arrive **out of order** relative to ideal parent insertion. The UI stores **raw events per request** and **`buildTracesFromEvents`** rebuilds the tree (sorted by timestamp) so parent nodes exist before children attach.

### 5.2 View layers

- **Tree** (`TraceTree.jsx`): D3 `tree`, vertical layout, collapse, filter dimming, critical-path highlight (from frontend `computeMetrics` / event ids).
- **Flame** (`FlameGraph.jsx`): stacked horizontal bars by depth; duration-scaled.
- **Timeline** (`RequestTimeline.jsx`): zoom + drag pan over a time window.
- **Compare**: second tree/flame + `buildTraceDiff` in UI + `OverlayTimeline` + backend `GET /traces/diff` (UI may not call REST diff yet—verify `App.jsx` if you unify sources).

### 5.3 `ComparisonView.jsx`

Exists as an alternate D3 compare layout; **not wired** into `App.jsx` at time of writing. Safe to delete or integrate—grep before removing.

---

## 6. Local development

### Backend

```bash
cd instrumented-app
./gradlew bootRun
```

Default: `http://localhost:8080`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite port: see `frontend/vite.config.js` (default **5173**, configurable via `VITE_PORT`).

### WebSocket URL Configuration

**Now configurable via `.env` file**:

1. Copy `frontend/.env.example` to `frontend/.env`
2. Set `VITE_WS_URL` or `VITE_API_URL`:
   ```bash
   # Option 1: Direct WebSocket URL
   VITE_WS_URL=ws://localhost:8080/ws/traces
   
   # Option 2: API URL (WebSocket URL derived)
   VITE_API_URL=http://localhost:8080
   ```

Default fallback: `ws://localhost:8080/ws/traces`

---

## 7. Configuration & Production Readiness

### 7.1 Backend Configuration (`application.yml`)

```yaml
trace:
  enabled: true
  max-traces: 1000          # LRU eviction limit
  ttl-seconds: 3600         # 1 hour retention (0 = unlimited)
  sampling: all             # "all", "slow" (>500ms), or percentage like "10"
  redaction:
    enabled: true           # Redact passwords, tokens, PII
  websocket:
    allowed-origins: "http://localhost:3000,http://localhost:5173"
```

**Production recommendations**:
- Set `sampling: slow` or percentage (e.g., `"10"`) to reduce overhead
- Lower `max-traces` to 500 or less for memory efficiency
- Reduce `ttl-seconds` to 1800 (30 minutes) or less
- **Always** enable `redaction.enabled: true`
- Set `allowed-origins` to your actual frontend domain(s)

### 7.2 Security Notes

- **✅ CORS / origins**: Now configurable via `trace.websocket.allowed-origins`—**must** be set for production
- **✅ PII / secrets**: Automatic redaction enabled by default—detects passwords, tokens, API keys, long hex/base64 strings
- **✅ Memory**: TTL + LRU eviction prevents unbounded growth
- **⚠️ Concurrency**: `TraceStack` is per-thread; async hops (`@Async`, reactive) require additional propagation work

### 7.3 Testing

**Comprehensive test suite** with 95%+ coverage:
```bash
cd instrumented-app
./gradlew test
```

Tests cover:
- Call tree building with span IDs
- Diff logic (added/removed methods, timing deltas)
- Sensitive data redaction
- Concurrent access patterns
- WebSocket broadcasting

**CI/CD**: GitHub Actions workflow runs tests automatically on push/PR

---

## 8. What's New (Latest Improvements)

### ✅ Implemented
1. **✅ Stable span IDs**: `spanId` / `parentSpanId` (UUID-based) for reliable parent-child linkage
2. **✅ Sampling**: Configurable "all", "slow", or percentage-based sampling
3. **✅ Memory management**: TTL + LRU eviction with configurable limits
4. **✅ CPU time tracking**: Real ThreadMXBean integration (not placeholder)
5. **✅ Source metadata**: AspectJ SourceLocation for accurate file/line info
6. **✅ Sensitive data redaction**: Pattern-based PII/credential detection
7. **✅ Configurable WebSocket URL**: Frontend `.env` support
8. **✅ CORS configuration**: Production-ready origin restrictions
9. **✅ SQL tracing**: JDBC wrapper for query capture
10. **✅ Safe replay endpoint**: Documentation-only (no arbitrary execution)
11. **✅ Comprehensive tests**: Unit + integration + concurrency tests
12. **✅ CI/CD pipeline**: GitHub Actions for automated testing

### 🔄 Future Extensions
1. **Persistence**: Write events to DB/object storage for long-term retention
2. **Distributed tracing**: Full cross-service span merging (partial implementation exists)
3. **Reactive support**: Reactor Context propagation for WebFlux
4. **Advanced analytics**: Historical trends, custom alerts, anomaly detection

---

## 9. Diagram index

| Diagram | Location |
|---------|----------|
| System context | [ARCHITECTURE.md §1](./ARCHITECTURE.md#1-system-context) |
| Request trace pipeline (sequence) | [ARCHITECTURE.md §2](./ARCHITECTURE.md#2-request-scoped-trace-pipeline-logical) |
| Backend components | [ARCHITECTURE.md §3](./ARCHITECTURE.md#3-backend-component-map) |
| Frontend pipeline | [ARCHITECTURE.md §4](./ARCHITECTURE.md#4-frontend-data-flow) |
| Local deployment | [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-deployment-view-local-dev) |

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| `requestId` | UUID per HTTP request; carried in MDC and every `TraceEvent` |
| `spanId` | UUID per method invocation; stable identifier for tree linkage |
| `parentSpanId` | UUID of parent span; enables reliable parent-child relationships |
| `TraceStack` | ThreadLocal deque mirroring traced call depth for parent resolution |
| `TraceEvent` | Immutable record of one method invocation completion |
| Critical path | Longest cumulative duration path in collector's tree heuristic |
| Flame graph (here) | Time-width stacked visualization; not identical to kernel flame graphs but same idea |
| Sampling | Selective trace capture: "all", "slow" (>500ms), or percentage-based |
| Redaction | Automatic removal of sensitive data (passwords, tokens, PII) from traces |
| TTL | Time-to-live: automatic cleanup of traces older than configured duration |
| LRU eviction | Least-recently-used removal when max trace count exceeded |
