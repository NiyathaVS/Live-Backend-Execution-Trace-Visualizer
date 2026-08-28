import React, { useEffect, useState, useMemo } from "react";
import { computeMetrics, flattenEvents, extractClassNameFromMethod, buildTracesFromEvents } from "./services/traceUtils";
import TraceTree from "./components/TraceTree";
import RequestTimeline from "./components/RequestTimeline";
import FlameGraph from "./components/FlameGraph";
import OverlayTimeline from "./components/OverlayTimeline";
import ComparisonView from "./components/ComparisonView";
import CodePreview from "./components/CodePreview";
import MetricsDashboard from "./components/MetricsDashboard";
import { connectWebSocket, disconnectWebSocket } from "./services/websocket";
import {
    fetchTraceDiff,
    fetchTraceAnalysis,
    fetchMetricsDashboard,
    persistTrace,
    exportUrl,
    otelExportUrl,
    searchTraces,
    fetchTraceHistory,
    fetchAlerts
} from "./services/traceApi";

/*
App responsibilities:
- Maintain per-request trace trees
- Track which request is selected
- Compute basic metrics (node count, slowest path)
- Provide controls (pause, clear, filter)
*/

export default function App() {
    const [eventsByRequest, setEventsByRequest] = useState({});
    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [paused, setPaused] = useState(false);
    const [methodFilter, setMethodFilter] = useState("");
    const [requestSearch, setRequestSearch] = useState("");
    const [bookmarked, setBookmarked] = useState(new Set());
    const [collapsedEventIds, setCollapsedEventIds] = useState(new Set());
    const [selectedNode, setSelectedNode] = useState(null);
    const [compareRequestId, setCompareRequestId] = useState(null);
    const [viewMode, setViewMode] = useState("tree");
    const [codePreview, setCodePreview] = useState({ visible: false, className: null, lineNumber: null });
    const [diffReport, setDiffReport] = useState(null);
    const [diffLoading, setDiffLoading] = useState(false);
    const [analysisReport, setAnalysisReport] = useState(null);
    const [metricsReport, setMetricsReport] = useState(null);
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [metricsError, setMetricsError] = useState(null);
    const [shareLink, setShareLink] = useState(null);
    const [traceSearchMethod, setTraceSearchMethod] = useState("");
    const [traceSearchMinMs, setTraceSearchMinMs] = useState("");
    const [traceSearchErrorsOnly, setTraceSearchErrorsOnly] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [historyTraces, setHistoryTraces] = useState([]);
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        connectWebSocket((event) => {
            if (paused) return;

            setEventsByRequest((prev) => {
                const requestId = event.requestId;

                const existing = prev[requestId] ?? [];
                const next = {
                    ...prev,
                    [requestId]: [...existing, event]
                };

                if (!selectedRequestId) {
                    setSelectedRequestId(requestId);
                }

                return next;
            });
        });

        return () => disconnectWebSocket();
    }, [paused, selectedRequestId]);

    const traces = useMemo(
        () => buildTracesFromEvents(eventsByRequest),
        [eventsByRequest]
    );

    const selectedTrace =
        selectedRequestId != null ? traces[selectedRequestId] : null;

    const compareTrace =
        compareRequestId && traces[compareRequestId]
            ? traces[compareRequestId]
            : null;

    const { nodeCount, maxExecution, slowPathEventIds } = useMemo(
        () => computeMetrics(selectedTrace),
        [selectedTrace]
    );

    const handleClear = () => {
        setEventsByRequest({});
        setSelectedRequestId(null);
        setCompareRequestId(null);
        setSelectedNode(null);
        setCollapsedEventIds(new Set());
    };

    const requestIds = Object.keys(traces);
    const filteredRequestIds = requestIds.filter((id) =>
        id.toLowerCase().includes(requestSearch.toLowerCase())
    );

    const flatEvents = useMemo(
        () => (selectedTrace ? flattenEvents(selectedTrace) : []),
        [selectedTrace]
    );

    const compareFlatEvents = useMemo(
        () => (compareTrace ? flattenEvents(compareTrace) : []),
        [compareTrace]
    );

    useEffect(() => {
        if (!selectedRequestId || !compareRequestId) {
            setDiffReport(null);
            return;
        }
        let cancelled = false;
        setDiffLoading(true);
        fetchTraceDiff(selectedRequestId, compareRequestId)
            .then((report) => {
                if (!cancelled) setDiffReport(report);
            })
            .catch(() => {
                if (!cancelled) setDiffReport(null);
            })
            .finally(() => {
                if (!cancelled) setDiffLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedRequestId, compareRequestId]);

    useEffect(() => {
        if (!selectedRequestId) {
            setAnalysisReport(null);
            return;
        }
        let cancelled = false;
        fetchTraceAnalysis(selectedRequestId)
            .then((report) => {
                if (!cancelled) setAnalysisReport(report);
            })
            .catch(() => {
                if (!cancelled) setAnalysisReport(null);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedRequestId]);

    useEffect(() => {
        let cancelled = false;
        const load = () => {
            setMetricsLoading(true);
            fetchMetricsDashboard()
                .then((report) => {
                    if (!cancelled) {
                        setMetricsReport(report);
                        setMetricsError(null);
                    }
                })
                .catch((err) => {
                    if (!cancelled) {
                        setMetricsError(err.message);
                    }
                })
                .finally(() => {
                    if (!cancelled) setMetricsLoading(false);
                });
        };
        load();
        const interval = setInterval(load, 15000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [eventsByRequest]);

    useEffect(() => {
        let cancelled = false;
        const runSearch = () => {
            const minMs = traceSearchMinMs ? Number(traceSearchMinMs) : undefined;
            searchTraces({
                method: traceSearchMethod || undefined,
                minDurationMs: minMs,
                hasError: traceSearchErrorsOnly ? true : undefined
            })
                .then((results) => {
                    if (!cancelled) setSearchResults(results);
                })
                .catch(() => {
                    if (!cancelled) setSearchResults([]);
                });
        };
        runSearch();
        const interval = setInterval(runSearch, 10000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [eventsByRequest, traceSearchMethod, traceSearchMinMs, traceSearchErrorsOnly]);

    useEffect(() => {
        let cancelled = false;
        fetchTraceHistory()
            .then((history) => {
                if (!cancelled) setHistoryTraces(history);
            })
            .catch(() => {
                if (!cancelled) setHistoryTraces([]);
            });
        return () => {
            cancelled = true;
        };
    }, [eventsByRequest]);

    useEffect(() => {
        let cancelled = false;
        fetchAlerts(selectedRequestId || undefined)
            .then((data) => {
                if (!cancelled) setAlerts(data);
            })
            .catch(() => {
                if (!cancelled) setAlerts([]);
            });
        const interval = setInterval(() => {
            fetchAlerts(selectedRequestId || undefined)
                .then((data) => {
                    if (!cancelled) setAlerts(data);
                })
                .catch(() => {});
        }, 15000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [selectedRequestId, eventsByRequest]);

    return (
        <div
            style={{
                fontFamily:
                    "system-ui, -apple-system, BlinkMacSystemFont, Inter, sans-serif",
                padding: 24,
                minHeight: "100vh",
                background:
                    "linear-gradient(135deg, #0f172a 0%, #020617 45%, #020617 100%)",
                color: "#e5e7eb"
            }}
        >
            <header
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 20
                }}
            >
                <div>
                    <h1 style={{ marginBottom: 4, fontSize: 24 }}>
                        Live Backend Execution Trace
                    </h1>
                    <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
                        Watch your Spring Boot methods execute in real time, with
                        per-request call trees and performance hotspots.
                    </p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        onClick={() => setPaused((p) => !p)}
                        style={{
                            padding: "6px 12px",
                            borderRadius: 999,
                            border: "1px solid #4b5563",
                            background: paused ? "#111827" : "#22c55e",
                            color: paused ? "#e5e7eb" : "#022c22",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer"
                        }}
                    >
                        {paused ? "Resume live" : "Pause live"}
                    </button>
                    <button
                        onClick={handleClear}
                        style={{
                            padding: "6px 12px",
                            borderRadius: 999,
                            border: "1px solid #4b5563",
                            background: "#0f172a",
                            color: "#e5e7eb",
                            fontSize: 12,
                            cursor: "pointer"
                        }}
                    >
                        Clear traces
                    </button>
                </div>
            </header>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "280px 1fr",
                    gap: 20,
                    alignItems: "stretch"
                }}
            >
                <aside
                    style={{
                        borderRadius: 16,
                        background: "rgba(15,23,42,0.9)",
                        border: "1px solid rgba(55,65,81,0.7)",
                        padding: 16,
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 480
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 10
                        }}
                    >
                        <h3
                            style={{
                                margin: 0,
                                fontSize: 14,
                                textTransform: "uppercase",
                                letterSpacing: 0.08
                            }}
                        >
                            Active Requests
                        </h3>
                        <span
                            style={{
                                fontSize: 11,
                                color: "#9ca3af"
                            }}
                        >
                            {requestIds.length} live
                        </span>
                    </div>

                    <input
                        type="text"
                        placeholder="Search requests…"
                        value={requestSearch}
                        onChange={(e) => setRequestSearch(e.target.value)}
                        style={{
                            marginBottom: 8,
                            padding: "6px 8px",
                            borderRadius: 999,
                            border: "1px solid #4b5563",
                            background: "#020617",
                            color: "#e5e7eb",
                            fontSize: 12,
                            outline: "none"
                        }}
                    />

                    <input
                        type="text"
                        placeholder="Filter methods in tree…"
                        value={methodFilter}
                        onChange={(e) => setMethodFilter(e.target.value)}
                        aria-label="Filter methods in trace tree"
                        style={{
                            marginBottom: 10,
                            padding: "6px 8px",
                            borderRadius: 999,
                            border: "1px solid #4b5563",
                            background: "#020617",
                            color: "#e5e7eb",
                            fontSize: 12,
                            outline: "none"
                        }}
                    />

                    <div
                        style={{
                            marginBottom: 10,
                            padding: 8,
                            borderRadius: 10,
                            border: "1px solid rgba(55,65,81,0.6)",
                            background: "rgba(2,6,23,0.6)"
                        }}
                    >
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "#cbd5e1" }}>
                            Trace search
                        </div>
                        <input
                            type="text"
                            placeholder="Method name…"
                            value={traceSearchMethod}
                            onChange={(e) => setTraceSearchMethod(e.target.value)}
                            aria-label="Search traces by method name"
                            style={{
                                width: "100%",
                                marginBottom: 4,
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: "1px solid #4b5563",
                                background: "#020617",
                                color: "#e5e7eb",
                                fontSize: 11
                            }}
                        />
                        <input
                            type="number"
                            placeholder="Min duration (ms)"
                            value={traceSearchMinMs}
                            onChange={(e) => setTraceSearchMinMs(e.target.value)}
                            aria-label="Minimum trace duration in milliseconds"
                            style={{
                                width: "100%",
                                marginBottom: 4,
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: "1px solid #4b5563",
                                background: "#020617",
                                color: "#e5e7eb",
                                fontSize: 11
                            }}
                        />
                        <label style={{ fontSize: 10, color: "#9ca3af", display: "flex", gap: 4, alignItems: "center" }}>
                            <input
                                type="checkbox"
                                checked={traceSearchErrorsOnly}
                                onChange={(e) => setTraceSearchErrorsOnly(e.target.checked)}
                            />
                            Errors only
                        </label>
                        {searchResults.length > 0 && (
                            <div style={{ marginTop: 6, maxHeight: 80, overflowY: "auto" }}>
                                {searchResults.slice(0, 5).map((r) => (
                                    <button
                                        key={r.requestId}
                                        onClick={() => setSelectedRequestId(r.requestId)}
                                        style={{
                                            display: "block",
                                            width: "100%",
                                            textAlign: "left",
                                            background: "transparent",
                                            border: "none",
                                            color: "#93c5fd",
                                            fontSize: 10,
                                            cursor: "pointer",
                                            padding: "2px 0"
                                        }}
                                    >
                                        {r.requestId.slice(0, 12)}… ({r.totalDurationMs}ms)
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {requestIds.length === 0 && (
                        <p
                            style={{
                                color: "#6b7280",
                                fontSize: 12,
                                marginTop: 8
                            }}
                        >
                            Hit the instrumented API and watch requests appear
                            here in real time.
                        </p>
                    )}

                    <div
                        style={{
                            marginTop: 8,
                            overflowY: "auto",
                            flex: 1,
                            paddingRight: 4
                        }}
                    >
                        {filteredRequestIds.map((requestId) => {
                            const isSelected = requestId === selectedRequestId;
                            const isBookmarked = bookmarked.has(requestId);
                            return (
                                <button
                                    key={requestId}
                                    onClick={() => setSelectedRequestId(requestId)}
                                    style={{
                                        display: "block",
                                        width: "100%",
                                        textAlign: "left",
                                        borderRadius: 10,
                                        border: "1px solid transparent",
                                        padding: 10,
                                        marginBottom: 6,
                                        background: isSelected
                                            ? "linear-gradient(135deg,#22c55e,#16a34a)"
                                            : "#020617",
                                        color: isSelected ? "#022c22" : "#e5e7eb",
                                        fontSize: 11,
                                        cursor: "pointer"
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 6,
                                            alignItems: "center"
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontFamily:
                                                    "ui-monospace, SFMono-Regular",
                                                fontSize: 10,
                                                wordBreak: "break-all"
                                            }}
                                        >
                                            {requestId}
                                        </div>
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setBookmarked((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(requestId)) {
                                                        next.delete(requestId);
                                                    } else {
                                                        next.add(requestId);
                                                    }
                                                    return next;
                                                });
                                            }}
                                            style={{
                                                fontSize: 12,
                                                cursor: "pointer"
                                            }}
                                        >
                                            {isBookmarked ? "★" : "☆"}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div
                        style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: "1px solid rgba(55,65,81,0.6)",
                            fontSize: 11,
                            color: "#9ca3af"
                        }}
                    >
                        {selectedTrace ? (
                            <>
                                <div style={{ marginBottom: 4 }}>
                                    <span style={{ color: "#e5e7eb" }}>Nodes:</span>{" "}
                                    {nodeCount}
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <span style={{ color: "#e5e7eb" }}>
                                        Slowest hop:
                                    </span>{" "}
                                    {maxExecution != null
                                        ? `${maxExecution} ms`
                                        : "n/a"}
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                    <a
                                        href={exportUrl(selectedRequestId, "json")}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={linkButtonStyle}
                                    >
                                        JSON
                                    </a>
                                    <a
                                        href={exportUrl(selectedRequestId, "svg")}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={linkButtonStyle}
                                    >
                                        SVG
                                    </a>
                                    <a
                                        href={exportUrl(selectedRequestId, "pdf")}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={linkButtonStyle}
                                    >
                                        PDF
                                    </a>
                                    <a
                                        href={otelExportUrl(selectedRequestId)}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={linkButtonStyle}
                                        title="OpenTelemetry JSON export"
                                    >
                                        OTEL
                                    </a>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const ref = await persistTrace(selectedRequestId);
                                                const base =
                                                    import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
                                                    "http://localhost:8080";
                                                setShareLink(`${base}${ref.sharePath}`);
                                            } catch {
                                                setShareLink(null);
                                            }
                                        }}
                                        style={linkButtonStyle}
                                    >
                                        Share
                                    </button>
                                </div>
                                {shareLink && (
                                    <div
                                        style={{
                                            marginTop: 6,
                                            fontSize: 10,
                                            wordBreak: "break-all",
                                            color: "#93c5fd"
                                        }}
                                    >
                                        {shareLink}
                                    </div>
                                )}
                            </>
                        ) : (
                            <span>Select a request to see details.</span>
                        )}
                    </div>

                    <MetricsDashboard
                        report={metricsReport}
                        loading={metricsLoading}
                        error={metricsError}
                    />

                    {historyTraces.length > 0 && (
                        <div
                            style={{
                                marginTop: 10,
                                paddingTop: 10,
                                borderTop: "1px solid rgba(55,65,81,0.6)"
                            }}
                        >
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                                Persisted history ({historyTraces.length})
                            </div>
                            <div style={{ maxHeight: 100, overflowY: "auto" }}>
                                {historyTraces.slice(0, 8).map((h) => (
                                    <div key={h.shareId} style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>
                                        {h.requestId.slice(0, 10)}… — {h.totalDurationMs}ms
                                        {h.hasError && (
                                            <span style={{ color: "#fca5a5", marginLeft: 4 }}>ERR</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {alerts.length > 0 && (
                        <div
                            style={{
                                marginTop: 10,
                                paddingTop: 10,
                                borderTop: "1px solid rgba(55,65,81,0.6)"
                            }}
                        >
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#fde68a", marginBottom: 6 }}>
                                Alerts ({alerts.length})
                            </div>
                            {alerts.slice(0, 5).map((a, i) => (
                                <div
                                    key={`${a.requestId}-${a.rule}-${i}`}
                                    style={{
                                        fontSize: 10,
                                        color: a.severity === "ERROR" ? "#fca5a5" : "#fde68a",
                                        marginBottom: 4
                                    }}
                                >
                                    [{a.rule}] {a.message}
                                </div>
                            ))}
                        </div>
                    )}
                </aside>

                <main
                    style={{
                        borderRadius: 16,
                        background: "rgba(15,23,42,0.9)",
                        border: "1px solid rgba(55,65,81,0.7)",
                        padding: 16,
                        minHeight: 480,
                        overflow: "hidden"
                    }}
                >
                    {!selectedTrace && (
                        <div
                            style={{
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#6b7280",
                                fontSize: 13
                            }}
                        >
                            No request selected. Trigger an API call and choose a
                            request from the left.
                        </div>
                    )}

                    {selectedTrace && (
                        <div
                            style={{
                                height: "100%",
                                display: "flex",
                                flexDirection: "column"
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "baseline",
                                    marginBottom: 8
                                }}
                            >
                                <h3
                                    style={{
                                        margin: 0,
                                        fontSize: 14,
                                        color: "#e5e7eb"
                                    }}
                                >
                                    Request ID
                                </h3>
                                <code
                                    style={{
                                        fontSize: 11,
                                        color: "#9ca3af"
                                    }}
                                >
                                    {selectedRequestId}
                                </code>
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    alignItems: "center",
                                    marginBottom: 8
                                }}
                            >
                                <label
                                    style={{
                                        fontSize: 11,
                                        color: "#9ca3af"
                                    }}
                                >
                                    View:
                                </label>
                                <select
                                    value={viewMode}
                                    onChange={(e) => setViewMode(e.target.value)}
                                    style={{
                                        fontSize: 11,
                                        background: "#020617",
                                        color: "#e5e7eb",
                                        borderRadius: 999,
                                        border: "1px solid #4b5563",
                                        padding: "2px 8px",
                                        outline: "none"
                                    }}
                                >
                                    <option value="tree">Tree</option>
                                    <option value="flame">Flame graph</option>
                                </select>
                                <label
                                    style={{
                                        fontSize: 11,
                                        color: "#9ca3af"
                                    }}
                                >
                                    Compare with:
                                </label>
                                <select
                                    value={compareRequestId || ""}
                                    onChange={(e) =>
                                        setCompareRequestId(
                                            e.target.value || null
                                        )
                                    }
                                    style={{
                                        fontSize: 11,
                                        background: "#020617",
                                        color: "#e5e7eb",
                                        borderRadius: 999,
                                        border: "1px solid #4b5563",
                                        padding: "2px 8px",
                                        outline: "none"
                                    }}
                                >
                                    <option value="">None</option>
                                    {requestIds
                                        .filter(
                                            (id) => id !== selectedRequestId
                                        )
                                        .map((id) => (
                                            <option key={id} value={id}>
                                                {id.slice(0, 16)}…
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div
                                style={{
                                    flex: 1,
                                    borderRadius: 12,
                                    background:
                                        "radial-gradient(circle at top left,#0f172a,#020617)",
                                    border: "1px solid rgba(55,65,81,0.8)",
                                    overflow: "hidden"
                                }}
                            >
                                {viewMode === "tree" ? (
                                    <TraceTree
                                        data={selectedTrace}
                                        slowPathEventIds={slowPathEventIds}
                                        methodFilter={methodFilter}
                                        collapsedEventIds={collapsedEventIds}
                                        onNodeClick={(node) => {
                                            setSelectedNode(node);
                                            const className = extractClassNameFromMethod(
                                                node?.methodName ?? node?.method
                                            );
                                            if (className) {
                                                setCodePreview({
                                                    visible: true,
                                                    className,
                                                    lineNumber:
                                                        node?.sourceLine > 0
                                                            ? node.sourceLine
                                                            : 1
                                                });
                                            }
                                        }}
                                        onToggleCollapse={(eventId) =>
                                            setCollapsedEventIds((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(eventId)) {
                                                    next.delete(eventId);
                                                } else {
                                                    next.add(eventId);
                                                }
                                                return next;
                                            })
                                        }
                                    />
                                ) : (
                                    <FlameGraph data={selectedTrace} />
                                )}
                            </div>

                            <RequestTimeline events={flatEvents} />

                            {selectedNode && (
                                <div
                                    style={{
                                        marginTop: 8,
                                        padding: 8,
                                        borderRadius: 8,
                                        background:
                                            "rgba(15,23,42,0.95)",
                                        border:
                                            "1px solid rgba(55,65,81,0.7)",
                                        fontSize: 11,
                                        color: "#e5e7eb"
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            marginBottom: 4
                                        }}
                                    >
                                        <strong>Selected node</strong>
                                        <button
                                            onClick={() =>
                                                setSelectedNode(null)
                                            }
                                            style={{
                                                border: "none",
                                                background: "transparent",
                                                color: "#9ca3af",
                                                cursor: "pointer",
                                                fontSize: 11
                                            }}
                                        >
                                            Close
                                        </button>
                                    </div>
                                    <div style={{ marginBottom: 4 }}>
                                        <span style={{ color: "#9ca3af" }}>
                                            {selectedNode.eventType === "SQL" ||
                                            (selectedNode.method || "").startsWith("SQL:")
                                                ? "Query:"
                                                : "Method:"}
                                        </span>{" "}
                                        <code>
                                            {selectedNode.eventType === "SQL"
                                                ? selectedNode.sql ||
                                                  selectedNode.params?.sql ||
                                                  selectedNode.method
                                                : selectedNode.methodName ||
                                                  selectedNode.method ||
                                                  "ROOT"}
                                        </code>
                                    </div>
                                    {selectedNode.slowQuery && (
                                        <div
                                            style={{
                                                marginBottom: 4,
                                                color: "#f97316",
                                                fontWeight: 600
                                            }}
                                        >
                                            Slow query risk (&gt;500ms)
                                        </div>
                                    )}
                                    <div style={{ marginBottom: 4 }}>
                                        <span style={{ color: "#9ca3af" }}>
                                            Duration:
                                        </span>{" "}
                                        {selectedNode.executionTimeMs != null
                                            ? `${selectedNode.executionTimeMs} ms`
                                            : "n/a"}
                                    </div>
                                    <div style={{ marginBottom: 4 }}>
                                        <span style={{ color: "#9ca3af" }}>
                                            Timestamp:
                                        </span>{" "}
                                        {selectedNode.timestamp}
                                    </div>
                                    <div style={{ marginBottom: 4 }}>
                                        <span style={{ color: "#9ca3af" }}>
                                            Thread:
                                        </span>{" "}
                                        {selectedNode.threadId}
                                    </div>
                                    <div style={{ marginBottom: 4 }}>
                                        <span style={{ color: "#9ca3af" }}>
                                            Parent:
                                        </span>{" "}
                                        {selectedNode.parentMethod || "ROOT"}
                                    </div>
                                    <div style={{ marginBottom: 4 }}>
                                        <span style={{ color: "#9ca3af" }}>
                                            Status:
                                        </span>{" "}
                                        <span
                                            style={{
                                                color:
                                                    selectedNode.status === "ERROR"
                                                        ? "#ef4444"
                                                        : "#22c55e",
                                                fontWeight: 600
                                            }}
                                        >
                                            {selectedNode.status || "SUCCESS"}
                                        </span>
                                    </div>
                                    {selectedNode.errorType && (
                                        <div style={{ marginBottom: 4 }}>
                                            <span style={{ color: "#9ca3af" }}>
                                                Error Type:
                                            </span>{" "}
                                            <code>{selectedNode.errorType}</code>
                                        </div>
                                    )}
                                    {selectedNode.errorMessage && (
                                        <div style={{ marginBottom: 4 }}>
                                            <span style={{ color: "#9ca3af" }}>
                                                Error Message:
                                            </span>{" "}
                                            <span>{selectedNode.errorMessage}</span>
                                        </div>
                                    )}
                                    <div style={{ marginBottom: 4 }}>
                                        <span style={{ color: "#9ca3af" }}>
                                            Params:
                                        </span>
                                        <pre
                                            style={{
                                                margin: 0,
                                                marginTop: 2,
                                                padding: 6,
                                                borderRadius: 6,
                                                background: "#020617",
                                                maxHeight: 120,
                                                overflow: "auto"
                                            }}
                                        >
                                            {JSON.stringify(
                                                selectedNode.params,
                                                null,
                                                2
                                            )}
                                        </pre>
                                    </div>
                                    <div>
                                        <span style={{ color: "#9ca3af" }}>
                                            Return:
                                        </span>
                                        <pre
                                            style={{
                                                margin: 0,
                                                marginTop: 2,
                                                padding: 6,
                                                borderRadius: 6,
                                                background: "#020617",
                                                maxHeight: 120,
                                                overflow: "auto"
                                            }}
                                        >
                                            {JSON.stringify(
                                                selectedNode.returnValue,
                                                null,
                                                2
                                            )}
                                        </pre>
                                    </div>
                                    {selectedNode.errorStackTrace && (
                                        <div>
                                            <span style={{ color: "#9ca3af" }}>
                                                Stack Trace:
                                            </span>
                                            <pre
                                                style={{
                                                    margin: 0,
                                                    marginTop: 2,
                                                    padding: 6,
                                                    borderRadius: 6,
                                                    background: "#020617",
                                                    maxHeight: 160,
                                                    overflow: "auto",
                                                    color: "#fca5a5"
                                                }}
                                            >
                                                {selectedNode.errorStackTrace}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}

                            {compareTrace && (
                                <div
                                    style={{
                                        marginTop: 16,
                                        borderTop:
                                            "1px dashed rgba(55,65,81,0.7)",
                                        paddingTop: 8
                                    }}
                                >
                                    <ComparisonView
                                        data1={selectedTrace}
                                        data2={compareTrace}
                                        label1={selectedRequestId?.slice(0, 16) + "…"}
                                        label2={compareRequestId?.slice(0, 16) + "…"}
                                        addedMethods={diffReport?.addedMethods || []}
                                        removedMethods={diffReport?.removedMethods || []}
                                    />
                                    <OverlayTimeline
                                        baseEvents={flatEvents}
                                        compareEvents={compareFlatEvents}
                                    />
                                    {analysisReport && (
                                        <div
                                            style={{
                                                marginTop: 8,
                                                padding: 10,
                                                borderRadius: 10,
                                                border: "1px solid rgba(55,65,81,0.8)",
                                                background: "rgba(2,6,23,0.85)"
                                            }}
                                        >
                                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                                                Root-cause analysis
                                            </div>
                                            {(analysisReport.rootCauseHints || []).map((hint, i) => (
                                                <div key={i} style={{ fontSize: 11, color: "#fde68a", marginBottom: 4 }}>
                                                    {hint}
                                                </div>
                                            ))}
                                            {(analysisReport.nPlusOneWarnings || []).map((w, i) => (
                                                <div key={`n1-${i}`} style={{ fontSize: 11, color: "#f97316", marginBottom: 4 }}>
                                                    {w}
                                                </div>
                                            ))}
                                            {(analysisReport.anomalies || []).map((a, i) => (
                                                <div key={`an-${i}`} style={{ fontSize: 11, color: "#fca5a5" }}>
                                                    {a}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {(diffReport || diffLoading) && (
                                        <div
                                            style={{
                                                marginTop: 8,
                                                padding: 10,
                                                borderRadius: 10,
                                                border: "1px solid rgba(55,65,81,0.8)",
                                                background: "rgba(2,6,23,0.85)"
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    marginBottom: 8
                                                }}
                                            >
                                                Analytical diff {diffLoading ? "(loading…)" : "(backend)"}
                                            </div>
                                            <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 6 }}>
                                                + Added methods:{" "}
                                                {diffReport.addedMethods.length > 0
                                                    ? diffReport.addedMethods.join(", ")
                                                    : "None"}
                                            </div>
                                            <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 8 }}>
                                                - Removed methods:{" "}
                                                {diffReport.removedMethods.length > 0
                                                    ? diffReport.removedMethods.join(", ")
                                                    : "None"}
                                            </div>
                                            <div style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>
                                                Largest timing deltas
                                            </div>
                                            <div style={{ display: "grid", gap: 4 }}>
                                                {diffReport.timingDeltas.length === 0 && (
                                                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                                                        No overlapping methods to compare.
                                                    </div>
                                                )}
                                                {diffReport.timingDeltas.map((delta) => (
                                                    <div
                                                        key={delta.method}
                                                        style={{
                                                            fontSize: 11,
                                                            color: delta.deltaMs > 0 ? "#fca5a5" : "#86efac"
                                                        }}
                                                    >
                                                        {delta.deltaMs > 0 ? "Δ+" : "Δ"}
                                                        {delta.deltaMs}ms {delta.method}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Code Preview Panel */}
            {codePreview.visible && (
                <CodePreview
                    className={codePreview.className}
                    lineNumber={codePreview.lineNumber}
                    onClose={() => setCodePreview({ visible: false, className: null, lineNumber: null })}
                />
            )}
        </div>
    );
}

const linkButtonStyle = {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#93c5fd",
    fontSize: 10,
    cursor: "pointer",
    textDecoration: "none"
};


