# Architecture

This document is the canonical reference for **system structure** and **data flow**. Diagrams use [Mermaid](https://mermaid.js.org/) syntax (rendered on GitHub, GitLab, many IDEs, and Markdown preview tools).

---

## 1. System context

High-level view: who talks to whom.

```mermaid
flowchart LR
    subgraph Clients
        Browser["Browser / React UI"]
        Curl["curl / API clients"]
    end

    subgraph InstrumentedApp["instrumented-app (Spring Boot)"]
        HTTP["HTTP Controllers"]
        AOP["TraceAspect (AOP)"]
        Collector["InMemoryTraceCollector"]
        WS["TraceWebSocketHandler\n/ws/traces"]
        REST["TraceReplayController\n/traces/*"]
    end

    Curl --> HTTP
    Browser -->|"HTTP (optional)"| HTTP
    Browser <-->|"WebSocket\nws://host:8080/ws/traces"| WS

    HTTP --> AOP
    AOP --> Collector
    AOP --> WS
    REST --> Collector
```

**Notes**

- The UI primarily consumes **WebSocket** events; HTTP to the app is used to **generate** traces (e.g. `GET /users/{id}`) and optional **REST** inspection (`/traces/...`).
- `shared-model` and `trace-collector` in the repo are placeholders for a future split (not separate deployables in the current codebase).

---

## 2. Request-scoped trace pipeline (logical)

Single HTTP request: correlation, stack, emission.

```mermaid
sequenceDiagram
    participant Client
    participant Filter as RequestIdFilter
    participant MDC as MDC (requestId)
    participant Stack as TraceStack (ThreadLocal)
    participant Aspect as TraceAspect
    participant App as Controller / Service / Repository
    participant Pub as ConsoleTraceEventPublisher
    participant Col as InMemoryTraceCollector
    participant WS as TraceWebSocketHandler
    participant UI as React Frontend

    Client->>Filter: HTTP request
    Filter->>MDC: put(requestId)
    Filter->>Stack: clear (start clean)
    Filter->>App: filterChain.doFilter

    loop Each traced method (@Around)
        Aspect->>Stack: peek parent
        Aspect->>Stack: push current method
        Aspect->>App: proceed()
        App-->>Aspect: return / throw
        Aspect->>Stack: pop
        Aspect->>Aspect: build TraceEvent
        Aspect->>Pub: publish(event)
        Aspect->>Col: addEvent(event)
        Aspect->>WS: broadcastEvent(event)
    end

    WS-->>UI: JSON TraceEvent (live)

    Filter->>MDC: remove(requestId)
    Filter->>Stack: clear
```

---

## 3. Backend component map

Inside `instrumented-app`.

```mermaid
flowchart TB
    subgraph Config
        TC[TraceConfiguration\nBeans: publisher, collector, ws handler]
        WSC[WebSocketConfig\nRegisters /ws/traces]
    end

    subgraph Tracing
        RF[RequestIdFilter]
        TS[TraceStack / TraceContext]
        TA[TraceAspect]
        TE[TraceEvent]
        TEP[TraceEventPublisher\nConsoleTraceEventPublisher]
        IMTC[InMemoryTraceCollector]
        TWH[TraceWebSocketHandler]
    end

    subgraph API
        UC[UserController\n/users]
        TRC[TraceReplayController\n/traces]
    end

    RF --> MDC[MDC requestId]
    TA --> TS
    TA --> TE
    TA --> TEP
    TA --> IMTC
    TA --> TWH
    WSC --> TWH
    TRC --> IMTC
    UC --> TA
```

---

## 4. Frontend data flow

From socket to trees and views.

```mermaid
flowchart LR
    WS[WebSocket\n/ws/traces] --> Parse[JSON parse TraceEvent]
    Parse --> Store["eventsByRequest\nmap requestId → events[]"]
    Store --> Build[buildTracesFromEvents\nrebuild trees]
    Build --> Views{Views}

    Views --> Tree[TraceTree\nD3 vertical tree]
    Views --> Flame[FlameGraph]
    Views --> TL[RequestTimeline\nzoom + pan]
    Views --> Overlay[OverlayTimeline\ncompare]
    Views --> Diff[Analytical diff\nin App.jsx]
```

---

## 5. Deployment view (local dev)

Typical developer setup.

```mermaid
flowchart TB
    subgraph Machine
        B["instrumented-app\n:8080"]
        F["Vite dev server\n:3000 (vite.config)"]
    end

    User[Developer] --> F
    User --> B
    F -->|"ws://localhost:8080/ws/traces"| B
```

**Port reminder**: Backend defaults to **8080**. Frontend Vite is configured for **3000** in `frontend/vite.config.js` (README may mention 5173 elsewhere—follow Vite config + terminal output).

---

## Related docs

- [PROJECT_DOCUMENTATION.md](../PROJECT_DOCUMENTATION.md) — full technical inventory
- [ENGINEERING_ONBOARDING.md](./ENGINEERING_ONBOARDING.md) — team handoff and operations
- [PORTFOLIO_RESUME_VERSION.md](./PORTFOLIO_RESUME_VERSION.md) — resume / portfolio framing
