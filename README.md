# Live Backend Execution Trace Visualizer

A production-ready, real-time execution tracing system for Spring Boot applications with a professional three-column observability dashboard.

[![CI](https://github.com/YOUR-ORG/YOUR-REPO/workflows/CI/badge.svg)](https://github.com/YOUR-ORG/YOUR-REPO/actions)

---

## 🚀 Quick Start

### Prerequisites
- Java 17+
- Node.js 18+
- Gradle 7+

### 1. Start the backend
```bash
cd instrumented-app
./gradlew bootRun
```
Runs on **http://localhost:8080**

### 2. Start the frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on **http://localhost:5173**

### 3. Trigger a trace
Open the dashboard and click one of the sample buttons, or:
```bash
curl http://localhost:8080/users/1
curl http://localhost:8080/orders/1001/fulfillment
```

The dashboard populates instantly.

### Configuration
1. Copy `frontend/.env.example` to `frontend/.env`
2. Adjust `VITE_API_URL` if the backend is not on `localhost:8080`
3. Tune sampling, retention, and auth in `instrumented-app/src/main/resources/application.yml`

---

## ✨ Feature Overview

### 🖥️ Three-Column Dashboard Layout
- **Left sidebar** — filterable trace list with health grades (A–F), duration bars, error/slow/SQL/contention badges, bookmark stars, and relative timestamps; Search tab with method/duration/error filters and persisted history
- **Centre panel** — trace summary bar + 8-metric span stats row + scrollable visualisations (tree, flame graph, timeline, node detail, SQL inspector, comparison)
- **Right insight rail** — always-visible: root-cause analysis, top-6 slowest spans with proportional bars, span type breakdown chart, local method latency table

### 📊 KPI Summary Bar
Four headline cards across the top, each with ambient glow and colour-coded thresholds:
- **Live Traces** — active request count
- **Error Rate** — global error% across all spans
- **Peak p99** — slowest method p99 latency
- **Active Alerts** — critical vs warning breakdown

### 📐 Span Stats Mini-Row
8 live numbers updated per trace: Total Duration · Spans · Errors · Slow Paths · SQL Queries · Critical Path spans · Threads · Peak Span ms

### 🔍 Real-Time Tracing
- **AOP instrumentation** for all `@RestController`, `@Service`, and `@Repository` classes
- **Stable UUID span IDs** for reliable parent-child tree construction
- **CPU time tracking** via `ThreadMXBean`
- **SQL query tracing** via custom JDBC proxy — slow-query detection and N+1 pattern recognition
- **WebSocket streaming** with configurable URL, shared-secret auth, and exponential-backoff auto-reconnect
- **Sensitive data redaction** — passwords, tokens, API keys, PII stripped automatically

### 🎨 Interactive Visualisations
- **D3 call tree** — collapsible, filterable by method name, live particle animation on new events
- **Flame graph** — click-to-zoom with breadcrumbs, hotspot ranking sidebar, critical-path glow; fully scrollable at any depth
- **Thread swimlane timeline** — zoom (1×–20×), drag-to-pan, colour-coded span types
- **Node detail panel** — Info / Params / Stack Trace / SQL tabs per selected node
- **SQL Query Inspector** — queries grouped by text, N+1 badge when a query fires >2×, per-call timing chips

### 🔬 Analysis & Insights (Right Rail — Always Visible)
- **Root-cause analysis banner** — hints, N+1 warnings, and anomalies surfaced automatically
- **Slowest Spans panel** — top 6 by duration with proportional inline bars, colour-coded thresholds
- **Span Breakdown chart** — METHOD / SQL / ERROR percentages with filled bars
- **Method Latency table** — call count, error%, max ms, and relative bar per method — computed locally from streamed events, no backend call required

### 🛡️ Production Ready
- **Configurable sampling**: `all`, `slow` (>500 ms), or percentage (e.g. `"10"`)
- **Memory management**: TTL + LRU eviction (default: 1000 traces, 1-hour TTL)
- **WebSocket authentication**: shared-secret token (zero friction by default)
- **Configurable CORS** for production origins
- **Comprehensive test suite**: backend JUnit + frontend Vitest (17 tests)
- **CI/CD pipeline** via GitHub Actions

### 🔗 Integrations & Exports
- **OpenTelemetry OTLP JSON** — drop into Jaeger / Zipkin
- **JSON / SVG / PDF** trace export
- **Share links** — persist a trace and generate a shareable URL
- **Distributed trace support** — W3C `traceparent` / `X-Trace-Id` header propagation
- **Async context propagation** — `@Async` and `CompletableFuture` span continuity

---

## 📖 Documentation

| Document | Contents |
|----------|----------|
| [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) | Full technical inventory, component reference, architecture overview |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Complete REST + WebSocket contract — every endpoint, field, and error shape |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Mermaid system diagrams, data flow, design decisions |
| [docs/FEATURES.md](docs/FEATURES.md) | Complete feature checklist with implementation notes |
| [docs/ENGINEERING_ONBOARDING.md](docs/ENGINEERING_ONBOARDING.md) | Developer guide, glossary, extension playbook |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Chronological record of every improvement made |
| [docs/PORTFOLIO_RESUME_VERSION.md](docs/PORTFOLIO_RESUME_VERSION.md) | Resume bullets, interview talking points, demo story |

---

## 🔧 Configuration

### Backend (`application.yml`)
```yaml
trace:
  enabled: true
  max-traces: 1000          # LRU eviction limit
  ttl-seconds: 3600         # 1 hour retention
  sampling: all             # "all", "slow", or percentage like "10"
  redaction:
    enabled: true
  websocket:
    allowed-origins: "http://localhost:5173"
    auth-token: "none"      # Set to a secret string to enable WS auth
```

### Frontend (`.env`)
```bash
VITE_API_URL=http://localhost:8080

# Optional — derived from VITE_API_URL if omitted
# VITE_WS_URL=ws://localhost:8080/ws/traces

# Required when auth-token is not "none"
# VITE_WS_TOKEN=your-secret
```

---

## 🧪 Testing

```bash
# Backend
cd instrumented-app && ./gradlew test

# Frontend
cd frontend && npm test

# Frontend build validation
cd frontend && npm run build
```

**Test coverage:**
- Backend: call tree building, span IDs, diff logic, redaction, concurrency, WebSocket broadcast
- Frontend (Vitest, 17 tests): `computeMetrics`, `flattenEvents`, `buildTracesFromEvents`, `extractClassNameFromMethod`

---

## 📡 REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/traces/{requestId}/json` | Full `CallTreeNode` JSON |
| `GET` | `/traces/{requestId}/analysis` | Root-cause hints, N+1 warnings, anomalies |
| `GET` | `/traces/diff` | Added/removed methods + timing deltas |
| `GET` | `/traces/metrics/dashboard` | p50/p95/p99 per method, error rate, anomalies |
| `GET` | `/traces/search` | Filter by method, duration, error flag |
| `GET` | `/traces/history` | Persisted trace summaries |
| `GET` | `/traces/alerts` | Active alert list |
| `POST` | `/traces/{requestId}/persist` | Persist trace + generate share link |
| `GET` | `/traces/{requestId}/export/{format}` | Export as `json` / `svg` / `pdf` |
| `GET` | `/traces/{requestId}/export/otel` | OpenTelemetry OTLP JSON |
| `GET` | `/traces/source` | Source code snippet lookup |
| `POST` | `/traces/{requestId}/replay` | Safe replay instructions (no execution) |

### Demo endpoints (instrumented sample app)

| Method | Endpoint | What it triggers |
|--------|----------|-----------------|
| `GET` | `/users/{id}` | 9-method call tree, user + order + profile fetch |
| `GET` | `/orders/{id}/fulfillment` | ~25-method tree: fraud check, inventory, payment, shipping |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│  instrumented-app  (Spring Boot :8080)               │
│                                                      │
│  RequestIdFilter → TraceAspect → TraceEvent          │
│        ↓                 ↓              ↓            │
│  MDC requestId    InMemoryCollector  WebSocket       │
│                    ↓          ↓       handler        │
│            REST /traces/*   Alerts/Metrics           │
└─────────────────────────────────────────────────────┘
           ↑ WebSocket (ws://)    ↑ REST (http://)
┌─────────────────────────────────────────────────────┐
│  React Frontend  (Vite :5173)                        │
│                                                      │
│  Header (LIVE · Pause · Clear)                       │
│  KPI Bar (Traces · Error Rate · p99 · Alerts)        │
│  ┌──────────────┬──────────────────┬──────────────┐  │
│  │ Left Sidebar │  Centre Panel    │ Right Rail   │  │
│  │ Traces tab   │  Span Stats Row  │ Root Cause   │  │
│  │ Search tab   │  Tree / Flame    │ Slow Spans   │  │
│  │ Alert dock   │  Timeline        │ Breakdown    │  │
│  │              │  Node Detail     │ Method       │  │
│  │              │  SQL Inspector   │ Latency      │  │
│  │              │  Comparison      │              │  │
│  └──────────────┴──────────────────┴──────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 🚦 Production Deployment

```yaml
trace:
  sampling: slow
  max-traces: 500
  ttl-seconds: 1800
  redaction:
    enabled: true
  websocket:
    allowed-origins: "https://your-domain.com"
    auth-token: "change-me-to-a-strong-random-secret"
```

```bash
VITE_API_URL=https://api.your-domain.com
VITE_WS_TOKEN=change-me-to-a-strong-random-secret
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

MIT License — see the LICENSE file for details.

---

**Built for debugging, performance analysis, and understanding complex Spring Boot call flows.**
