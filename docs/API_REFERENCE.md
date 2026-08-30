# API Reference

Complete contract for all HTTP and WebSocket endpoints. The backend runs on **`http://localhost:8080`** by default.

All REST endpoints return `application/json` unless noted. Errors return `{ requestId, timestamp, status, error, message }`.

---

## WebSocket

### `GET /ws/traces` (WebSocket upgrade)

Live stream of `TraceEvent` JSON objects. One message per method invocation or SQL query as it completes.

| Parameter | Location | Description |
|-----------|----------|-------------|
| `token` | Query string | Required only when `trace.websocket.auth-token` is set (not `"none"`). Must match the configured secret. |

**Connection behaviour:**
- Messages arrive as UTF-8 JSON text frames.
- The server broadcasts to all connected sessions — no per-session filtering.
- The frontend reconnects automatically with exponential backoff (1 s → 30 s cap).

**Message shape — `TraceEvent`:**

| Field | Type | Notes |
|-------|------|-------|
| `eventId` | string (UUID) | Unique per event |
| `spanId` | string (UUID) | Unique per method invocation — primary tree linkage key |
| `parentSpanId` | string (UUID) | Parent invocation; `null` for root spans |
| `requestId` | string (UUID) | HTTP request correlation ID |
| `method` | string | Fully-qualified method signature, e.g. `com.example.tracer.service.UserService.getUser(Long)` |
| `methodName` | string | Short method name |
| `params` | object | Captured arguments after redaction |
| `returnValue` | any | Captured return value after redaction |
| `executionTimeMs` | number | Wall-clock duration in ms |
| `threadCpuTimeMs` | number | CPU time via `ThreadMXBean`; `0` if unsupported |
| `threadName` | string | OS thread name |
| `threadState` | string | JVM thread state at invocation start |
| `timestamp` | string | ISO-8601 invocation start time |
| `status` | `"SUCCESS"` \| `"ERROR"` | Outcome |
| `errorType` | string \| null | Exception class name |
| `errorMessage` | string \| null | Exception message |
| `errorStackTrace` | string \| null | Full stack trace |
| `sourceFile` | string \| null | Source file name from AspectJ |
| `sourceLine` | number \| null | Source line number |
| `eventType` | `"METHOD"` \| `"SQL"` | Span category |
| `slowPath` | boolean | `true` if execution exceeded slow-path threshold |
| `isOnCriticalPath` | boolean | `true` if on the longest-duration branch |
| `contentionRisk` | boolean | Heuristic: possible thread contention |
| `resourceLeakSuspicion` | boolean | Heuristic: possible resource leak |
| `logicGapRisk` | boolean | Heuristic: suspicious execution gap |
| `slowQuery` | boolean | SQL only: `true` if query ≥ 500 ms |
| `sql` | string \| null | SQL only: raw query text |

---

## Trace Endpoints

Base path: `/traces`

---

### `GET /traces/{requestId}`

Returns a text-formatted call tree for the given request.

**Response:** `text/plain` — indented tree of method names and durations.

---

### `GET /traces/{requestId}/json`

Returns the full `CallTreeNode` tree as JSON.

**Response:** Nested tree with all `TraceEvent` fields plus collector-computed flags.

---

### `GET /traces/{requestId}/analysis`

Returns root-cause analysis for the given request.

**Response:**

```json
{
  "requestId": "...",
  "rootCauseHints": ["string"],
  "nPlusOneWarnings": ["string"],
  "anomalies": ["string"],
  "warnings": ["string"]
}
```

---

### `GET /traces/diff`

Compares two traces and returns a structured diff.

**Query parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `baseRequestId` | Yes | Base trace |
| `compareRequestId` | Yes | Trace to compare against the base |

**Response:**

```json
{
  "addedMethods": ["string"],
  "removedMethods": ["string"],
  "timingDeltas": [
    { "method": "string", "baseDurationMs": 0, "compareDurationMs": 0, "deltams": 0 }
  ]
}
```

`timingDeltas` is limited to the top 8 changes by absolute magnitude.

---

### `GET /traces/metrics/dashboard`

Returns per-method aggregate statistics across all retained traces.

**Response:**

```json
{
  "methodStats": {
    "com.example.Service.method": {
      "count": 0, "avgMs": 0, "p50Ms": 0, "p95Ms": 0, "p99Ms": 0,
      "variance": 0, "errorRate": 0
    }
  },
  "anomalies": ["string"]
}
```

Polled by the frontend every 15 seconds.

---

### `GET /traces/search`

Searches retained traces by method name, duration, or error flag.

**Query parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `method` | No | Substring match on method name |
| `minDurationMs` | No | Minimum total trace duration in ms |
| `hasError` | No | `true` to filter to error traces only |
| `limit` | No | Max results (default: 50) |

**Response:** `TraceSearchResult[]` — array of matching trace summaries.

---

### `GET /traces/history`

Returns summaries of all persisted (shared) traces.

**Response:** `PersistedTraceSummary[]` — array of `{ shareId, requestId, timestamp, sharePath }`.

---

### `GET /traces/alerts`

Returns the active alert list.

**Query parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `requestId` | No | Scope alerts to a specific request |

**Response:** `TraceAlert[]` — array of `{ alertId, requestId, message, severity, timestamp }` where `severity` is `"ERROR"` or `"WARN"`.

---

### `POST /traces/{requestId}/persist`

Persists a trace to disk and returns a shareable reference.

**Response:**

```json
{
  "shareId": "string",
  "sharePath": "string"
}
```

---

## Export Endpoints

### `GET /traces/{requestId}/export/json`

Downloads the raw trace as a JSON file.

**Response:** `application/json` with `Content-Disposition: attachment`.

---

### `GET /traces/{requestId}/export/svg`

Downloads the trace call tree as an SVG diagram.

**Response:** `image/svg+xml` with `Content-Disposition: attachment`.

---

### `GET /traces/{requestId}/export/pdf`

Downloads a PDF trace report.

**Response:** `application/pdf` with `Content-Disposition: attachment`.

---

### `GET /traces/{requestId}/export/otel`

Exports the trace as OpenTelemetry OTLP JSON, compatible with Jaeger and Zipkin.

**Response:** `application/json` — OTLP `resourceSpans` structure.

---

## Source Code Endpoints

### `GET /traces/source`

Returns a source code snippet from the classpath.

**Query parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `className` | Yes | Fully-qualified class name (e.g. `com.example.tracer.service.UserService`) |
| `lineNumber` | Yes | Target line number |
| `contextLines` | No | Lines of context above and below (default: 5) |

**Response:**

```json
{
  "lines": ["string"],
  "startLine": 0,
  "highlightLine": 0
}
```

Returns `null` if the source file is not on the classpath or not in a `src/` directory.

---

### `GET /traces/{requestId}/source`

Request-scoped variant — same as above but scoped to a specific request for path construction.

**Query parameters:** `className`, `lineNumber` (same as above).

---

## Replay Endpoint

### `POST /traces/{requestId}/replay`

Returns safe replay instructions for the given trace. Does **not** re-execute any code.

**Response:**

```json
{
  "requestId": "string",
  "replayInstructions": "string",
  "traceStructure": { }
}
```

---

## Demo Endpoints

These endpoints exist to generate interesting traces for the dashboard demo. They are instrumented with `@RestController` and intercepted by `TraceAspect`.

| Method | Path | Spans generated |
|--------|------|-----------------|
| `GET` | `/users/{id}` | 9-method call tree: UserController → UserService → UserRepository + profile enrichment |
| `GET` | `/orders/{id}/fulfillment` | Multi-service order flow: validation, fraud, inventory, pricing, payment, shipping, notifications |

---

## Error Response Shape

All REST errors (from `GlobalExceptionHandler`) return:

```json
{
  "requestId": "uuid-or-null",
  "timestamp": "2024-01-01T12:00:00",
  "status": 400,
  "error": "IllegalArgument",
  "message": "..."
}
```

`requestId` is pulled from MDC — it is the same ID that appears in the trace for that request, enabling instant correlation.

---

## Related Docs

- [PROJECT_DOCUMENTATION.md](../PROJECT_DOCUMENTATION.md) — full technical inventory
- [ARCHITECTURE.md](./ARCHITECTURE.md) — system diagrams and data flow
- [ENGINEERING_ONBOARDING.md](./ENGINEERING_ONBOARDING.md) — developer guide and extension playbook
