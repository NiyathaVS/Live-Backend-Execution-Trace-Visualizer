# Live Backend Execution Trace Visualizer

A production-ready, real-time execution tracing system for Spring Boot applications with rich interactive visualizations.

[![CI](https://github.com/YOUR-ORG/YOUR-REPO/workflows/CI/badge.svg)](https://github.com/YOUR-ORG/YOUR-REPO/actions)

## 🚀 Quick Start

### Prerequisites
- Java 17+
- Node.js 18+
- Gradle 7+

### Backend
```bash
cd instrumented-app
./gradlew bootRun
```
Backend runs on **http://localhost:8080**

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on **http://localhost:5173**

### Configuration
1. Copy `frontend/.env.example` to `frontend/.env`
2. Adjust `VITE_WS_URL` if backend is not on localhost:8080
3. Modify `instrumented-app/src/main/resources/application.yml` for trace settings

## ✨ Key Features

### 🔍 Real-Time Tracing
- **AOP-based instrumentation** for Spring components
- **Stable span IDs** (UUID) for reliable parent-child relationships
- **CPU time tracking** via ThreadMXBean
- **SQL query tracing** with slow query detection
- **WebSocket streaming** to frontend with configurable URLs

### 🛡️ Production Ready
- **Configurable sampling**: all, slow (>500ms), or percentage-based
- **Memory management**: TTL + LRU eviction (default: 1000 traces, 1-hour TTL)
- **Sensitive data redaction**: passwords, tokens, API keys, PII
- **Configurable CORS** for WebSocket connections
- **WebSocket authentication**: shared-secret token (disabled by default, one config line to enable)
- **Auto-reconnect**: exponential backoff on WebSocket disconnect (1 s → 30 s cap)
- **Comprehensive test suite**: backend JUnit + frontend Vitest (17 tests)
- **CI/CD pipeline** via GitHub Actions

### 📊 Rich Visualizations
- **Tree View**: Collapsible call hierarchy with D3
- **Flame Graph**: Horizontal stacked bars by execution time
- **Timeline**: Zoom/pan time-axis visualization
- **Comparison Mode**: Side-by-side diff with analytical insights

### 🔬 Analysis & Insights
- **Automatic risk detection**: slow paths, resource leaks, contention
- **Critical path calculation**: longest execution path
- **Cross-request diff**: added/removed methods, timing deltas
- **Error tracking**: full stack traces with visual highlighting

## 📖 Documentation

- **[Complete Feature List](docs/FEATURES.md)** - All implemented features
- **[Architecture](docs/ARCHITECTURE.md)** - System design and diagrams
- **[Engineering Onboarding](docs/ENGINEERING_ONBOARDING.md)** - Developer guide
- **[Project Documentation](PROJECT_DOCUMENTATION.md)** - Detailed technical docs

## 🔧 Configuration

### Backend (`application.yml`)
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
    auth-token: "none"      # Set to a secret string to enable WS auth
```

### Frontend (`.env`)
```bash
# WebSocket URL for trace backend
VITE_WS_URL=ws://localhost:8080/ws/traces

# Or use API URL (WebSocket URL will be derived)
VITE_API_URL=http://localhost:8080

# Optional: must match trace.websocket.auth-token when auth is enabled
# VITE_WS_TOKEN=your-secret
```

## 🧪 Testing

### Run Backend Tests
```bash
cd instrumented-app
./gradlew test
```

### Run Frontend Tests
```bash
cd frontend
npm test
```

### Run Frontend Build
```bash
cd frontend
npm run build
```

### Test Coverage
- **Backend unit tests**: Call tree building, diff logic, redaction, metrics
- **Backend integration tests**: Concurrent access, WebSocket broadcasting
- **Frontend unit tests** (Vitest): `computeMetrics`, `flattenEvents`, `buildTracesFromEvents`, `extractClassNameFromMethod` — 17 tests
- **Edge cases**: Out-of-order events, orphan spans, duplicate methods, errors

## 📡 REST API

### Trace Retrieval
- `GET /traces/{requestId}` - Text tree
- `GET /traces/{requestId}/json` - Full JSON
- `GET /traces/{requestId}/analysis` - Analysis report

### Comparison
- `GET /traces/diff?baseRequestId=X&compareRequestId=Y` - Diff report

### Source Code
- `GET /traces/source?className=X&lineNumber=Y` - Source snippet

### Replay (Safe Mode)
- `POST /traces/{requestId}/replay` - Replay instructions (no execution)

## 🏗️ Architecture

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│  Spring Boot    │◄──────────────────────────►│  React Frontend  │
│  Application    │                             │                  │
│                 │         REST API            │  - Tree View     │
│  - TraceAspect  │◄──────────────────────────►│  - Flame Graph   │
│  - Collector    │                             │  - Timeline      │
│  - SQL Tracing  │                             │  - Comparison    │
└─────────────────┘                             └──────────────────┘
```

### Key Components

**Backend**:
- `TraceAspect` - AOP interceptor for method tracing
- `InMemoryTraceCollector` - Tree builder with sampling & retention
- `SensitiveDataRedactor` - Pattern-based data redaction
- `TraceWebSocketHandler` - Real-time event broadcasting
- `WebSocketAuthInterceptor` - Shared-secret handshake guard

**Frontend**:
- `App.jsx` - Main UI with request management
- `TraceTree.jsx` - D3-based tree visualization
- `FlameGraph.jsx` - Horizontal flame graph
- `websocket.js` - WebSocket client with reconnect + configurable URL
- `traceUtils.js` - Pure utility functions (tree building, metrics)

## 🔐 Security

- **Sensitive data redaction** enabled by default
- **CORS origins** configurable for production
- **WebSocket authentication** via shared-secret token (opt-in, zero config for dev)
- **No arbitrary code execution** in replay endpoint
- **Input validation** on all REST endpoints

## 🚦 Production Deployment

### Recommended Settings
```yaml
trace:
  sampling: slow              # Only trace slow requests
  max-traces: 500             # Lower memory footprint
  ttl-seconds: 1800           # 30 minutes retention
  redaction:
    enabled: true             # Always enable in production
  websocket:
    allowed-origins: "https://your-domain.com"
    auth-token: "change-me-to-a-strong-random-secret"
```

### Environment Variables
```bash
# Frontend
VITE_WS_URL=wss://api.your-domain.com/ws/traces
VITE_API_URL=https://api.your-domain.com
VITE_WS_TOKEN=change-me-to-a-strong-random-secret
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Spring Boot for the excellent AOP framework
- D3.js for powerful visualizations
- React for the interactive UI
- Vite for blazing-fast development

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ for debugging and performance analysis**