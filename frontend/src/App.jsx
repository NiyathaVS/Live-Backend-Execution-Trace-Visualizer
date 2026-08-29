import React, { useState, useMemo, useEffect } from "react";
import { computeMetrics, flattenEvents, extractClassNameFromMethod, buildTracesFromEvents } from "./services/traceUtils";
import TraceTree from "./components/TraceTree";
import RequestTimeline from "./components/RequestTimeline";
import FlameGraph from "./components/FlameGraph";
import CodePreview from "./components/CodePreview";
import MetricsDashboard from "./components/MetricsDashboard";
import AnalysisBanner from "./components/AnalysisBanner";
import NodeDetailPanel from "./components/NodeDetailPanel";
import ComparisonSection from "./components/ComparisonSection";
import { useTraceStream } from "./hooks/useTraceStream";
import { useComparisonState } from "./hooks/useComparisonState";
import { useSearchAndMetrics } from "./hooks/useSearchAndMetrics";
import { persistTrace, exportUrl, otelExportUrl } from "./services/traceApi";
import { COLORS, Badge, DurationBar } from "./theme.jsx";

export default function App() {
    const { eventsByRequest, selectedRequestId, setSelectedRequestId, paused, setPaused, clearAll, latestEvent } = useTraceStream();
    const [methodFilter, setMethodFilter]     = useState("");
    const [requestSearch, setRequestSearch]   = useState("");
    const [bookmarked, setBookmarked]         = useState(new Set());
    const [collapsedEventIds, setCollapsedEventIds] = useState(new Set());
    const [selectedNode, setSelectedNode]     = useState(null);
    const [nodeTab, setNodeTab]               = useState("info"); // "info" | "params" | "stack"
    const [viewMode, setViewMode]             = useState("tree");
    const [codePreview, setCodePreview]       = useState({ visible: false, className: null, lineNumber: null });
    const [shareLink, setShareLink]           = useState(null);
    const [shareCopied, setShareCopied]       = useState(false);
    const [now, setNow]                       = useState(() => Date.now());
    const [traceSearchMethod, setTraceSearchMethod]     = useState("");
    const [traceSearchMinMs, setTraceSearchMinMs]       = useState("");
    const [traceSearchErrorsOnly, setTraceSearchErrorsOnly] = useState(false);

    const { compareRequestId, setCompareRequestId, diffReport, diffLoading, analysisReport, reset: resetComparison } =
        useComparisonState(selectedRequestId);

    const { metricsReport, metricsLoading, metricsError, searchResults, searchError, historyTraces, alerts } =
        useSearchAndMetrics(eventsByRequest, selectedRequestId, {
            method: traceSearchMethod, minMs: traceSearchMinMs, errorsOnly: traceSearchErrorsOnly,
        });

    const traces = useMemo(() => buildTracesFromEvents(eventsByRequest), [eventsByRequest]);
    const selectedTrace = selectedRequestId != null ? traces[selectedRequestId] : null;
    const compareTrace  = compareRequestId && traces[compareRequestId] ? traces[compareRequestId] : null;
    const { nodeCount, maxExecution, slowPathEventIds } = useMemo(() => computeMetrics(selectedTrace), [selectedTrace]);
    const flatEvents        = useMemo(() => selectedTrace ? flattenEvents(selectedTrace) : [], [selectedTrace]);
    const compareFlatEvents = useMemo(() => compareTrace ? flattenEvents(compareTrace) : [], [compareTrace]);
    const requestIds        = Object.keys(traces);
    const filteredRequestIds = requestIds.filter(id => id.toLowerCase().includes(requestSearch.toLowerCase()));

    const handleClear = () => { clearAll(); resetComparison(); setSelectedNode(null); setCollapsedEventIds(new Set()); };

    // Tick every 15 s so relative timestamps ("2s ago", "1m ago") stay fresh
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 15_000);
        return () => clearInterval(id);
    }, []);

    // per-request summary stats derived from events
    const requestStats = useMemo(() => {
        const out = {};
        for (const [rid, evts] of Object.entries(eventsByRequest)) {
            const errors     = evts.filter(e => e.status === "ERROR").length;
            const slow       = evts.filter(e => e.slowPath).length;
            const contention = evts.filter(e => e.contentionRisk).length;
            const totalMs    = evts.reduce((s, e) => Math.max(s, e.executionTimeMs || 0), 0);
            // First event timestamp — used for "X ago" display
            const firstTs    = evts.reduce((min, e) => {
                const t = e.timestamp ? new Date(e.timestamp).getTime() : Infinity;
                return t < min ? t : min;
            }, Infinity);
            out[rid] = { errors, slow, contention, totalMs, count: evts.length, firstTs };
        }
        return out;
    }, [eventsByRequest]);

    // ── styles ────────────────────────────────────────────────────────────
    const panelStyle = {
        borderRadius: 14, background: COLORS.surface,
        border: `1px solid ${COLORS.border}`, padding: 16,
    };
    const inputStyle = {
        width: "100%", padding: "6px 10px", borderRadius: 8,
        border: `1px solid ${COLORS.border}`, background: COLORS.bg,
        color: COLORS.text, fontSize: 12, outline: "none", boxSizing: "border-box",
    };
    const tabBtn = (active) => ({
        padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
        border: "none",
        background: active ? COLORS.blue : "transparent",
        color: active ? "#000" : COLORS.muted,
    });

    return (
        <div style={{
            fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,Inter,sans-serif",
            background: COLORS.bg, color: COLORS.text, minHeight: "100vh",
            display: "flex", flexDirection: "column",
        }}>
            {/* ── HEADER ──────────────────────────────────────────────────── */}
            <header style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 24px", borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.surface, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: "linear-gradient(135deg,#3b82f6,#22c55e)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, fontWeight: 900, color: "#fff",
                    }}>T</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: -0.3 }}>
                            Live Execution Trace
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 1 }}>
                            Real-time Spring Boot method tracing
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {/* live indicator */}
                    {!paused && (
                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: COLORS.green }}>
                            <span style={{
                                width: 7, height: 7, borderRadius: "50%",
                                background: COLORS.green,
                                boxShadow: `0 0 6px ${COLORS.green}`,
                                animation: "pulse 1.5s infinite",
                            }} />
                            Live
                        </span>
                    )}
                    {alerts.length > 0 && (
                        <Badge color={COLORS.red} title={`${alerts.length} active alert(s)`}>
                            {alerts.length} alert{alerts.length > 1 ? "s" : ""}
                        </Badge>
                    )}
                    <button onClick={() => setPaused(p => !p)} style={{
                        padding: "6px 14px", borderRadius: 8,
                        border: `1px solid ${paused ? COLORS.green : COLORS.border}`,
                        background: paused ? COLORS.green + "22" : COLORS.surfaceHi,
                        color: paused ? COLORS.green : COLORS.text,
                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}>
                        {paused ? "▶ Resume" : "⏸ Pause"}
                    </button>
                    <button onClick={handleClear} style={{
                        padding: "6px 14px", borderRadius: 8,
                        border: `1px solid ${COLORS.border}`,
                        background: COLORS.surfaceHi, color: COLORS.muted,
                        fontSize: 12, cursor: "pointer",
                    }}>
                        ✕ Clear
                    </button>
                </div>
            </header>

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
                ::-webkit-scrollbar{width:6px;height:6px}
                ::-webkit-scrollbar-track{background:transparent}
                ::-webkit-scrollbar-thumb{background:${COLORS.border};border-radius:3px}
            `}</style>

            {/* ── BODY ────────────────────────────────────────────────────── */}
            <div style={{
                display: "grid", gridTemplateColumns: "300px 1fr",
                gap: 0, flex: 1, overflow: "hidden",
            }}>
                {/* ── SIDEBAR ──────────────────────────────────────────── */}
                <aside style={{
                    borderRight: `1px solid ${COLORS.border}`,
                    display: "flex", flexDirection: "column",
                    overflow: "hidden", background: COLORS.surface,
                }}>
                    {/* search bar */}
                    <div style={{ padding: "12px 14px 0", flexShrink: 0 }}>
                        <input
                            style={inputStyle}
                            placeholder="Search request IDs…"
                            value={requestSearch}
                            onChange={e => setRequestSearch(e.target.value)}
                        />
                    </div>

                    {/* filter methods */}
                    <div style={{ padding: "8px 14px 0", flexShrink: 0 }}>
                        <input
                            style={inputStyle}
                            placeholder="Filter methods in tree…"
                            value={methodFilter}
                            onChange={e => setMethodFilter(e.target.value)}
                            aria-label="Filter methods in trace tree"
                        />
                    </div>

                    {/* header row */}
                    <div style={{
                        padding: "10px 14px 6px",
                        display: "flex", justifyContent: "space-between",
                        fontSize: 11, fontWeight: 700, color: COLORS.muted,
                        textTransform: "uppercase", letterSpacing: 0.8, flexShrink: 0,
                    }}>
                        <span>Active Requests</span>
                        <span style={{ color: COLORS.text }}>{requestIds.length} live</span>
                    </div>

                    {/* request list */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "0 10px" }}>
                        {filteredRequestIds.length === 0 && (
                            <div style={{
                                margin: "24px 4px", color: COLORS.muted, fontSize: 12,
                                textAlign: "center", lineHeight: 1.6,
                            }}>
                                No requests yet.<br/>Hit <code style={{ color: COLORS.blue }}>/users/1</code> or <code style={{ color: COLORS.blue }}>/orders/1001/fulfillment</code>
                            </div>
                        )}
                        {filteredRequestIds.map(rid => {
                            const isSelected = rid === selectedRequestId;
                            const stats = requestStats[rid] || {};
                            const hasError = stats.errors > 0;
                            const hasContention = stats.contention > 0;
                            const isBookmarked = bookmarked.has(rid);
                            return (
                                <button key={rid} onClick={() => setSelectedRequestId(rid)} style={{
                                    display: "block", width: "100%", textAlign: "left",
                                    padding: "9px 10px", marginBottom: 4, borderRadius: 10,
                                    border: `1px solid ${isSelected ? COLORS.blue : hasError ? COLORS.red + "55" : COLORS.border}`,
                                    background: isSelected ? COLORS.blue + "18" : COLORS.surfaceHi,
                                    cursor: "pointer", transition: "border-color .15s",
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <code style={{
                                            fontSize: 10, color: isSelected ? COLORS.blue : COLORS.text,
                                            wordBreak: "break-all", lineHeight: 1.4, flex: 1,
                                        }}>{rid}</code>
                                        <span
                                            onClick={e => { e.stopPropagation(); setBookmarked(p => { const n=new Set(p); n.has(rid)?n.delete(rid):n.add(rid); return n; }); }}
                                            style={{ fontSize: 13, marginLeft: 6, color: isBookmarked ? COLORS.yellow : COLORS.muted, cursor: "pointer" }}
                                        >{isBookmarked ? "★" : "☆"}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                                        <span style={{ fontSize: 10, color: COLORS.muted }}>{stats.totalMs}ms</span>
                                        <span style={{ fontSize: 10, color: COLORS.muted }}>·</span>
                                        <span style={{ fontSize: 10, color: COLORS.muted }}>{stats.count} spans</span>
                                        <span style={{ fontSize: 10, color: COLORS.muted }}>·</span>
                                        <span style={{ fontSize: 10, color: COLORS.muted }}>{relativeTime(stats.firstTs, now)}</span>
                                        {hasError && <Badge color={COLORS.red}>{stats.errors} ERR</Badge>}
                                        {stats.slow > 0 && <Badge color={COLORS.orange}>{stats.slow} SLOW</Badge>}
                                        {hasContention && <Badge color={COLORS.purple}>CONTENTION</Badge>}
                                    </div>
                                    <DurationBar ms={stats.totalMs} maxMs={maxExecution || stats.totalMs} />
                                </button>
                            );
                        })}
                    </div>

                    {/* ── trace search ───────────────────────────────────── */}
                    <div style={{
                        padding: "10px 14px", borderTop: `1px solid ${COLORS.border}`, flexShrink: 0,
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>
                            Trace Search
                        </div>
                        <input style={{ ...inputStyle, marginBottom: 5 }}
                            placeholder="Method name…" value={traceSearchMethod}
                            onChange={e => setTraceSearchMethod(e.target.value)} />
                        <input style={{ ...inputStyle, marginBottom: 5 }}
                            type="number" placeholder="Min duration (ms)" value={traceSearchMinMs}
                            onChange={e => setTraceSearchMinMs(e.target.value)} />
                        <label style={{ fontSize: 11, color: COLORS.muted, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                            <input type="checkbox" checked={traceSearchErrorsOnly}
                                onChange={e => setTraceSearchErrorsOnly(e.target.checked)} />
                            Errors only
                        </label>
                        {searchError && (
                            <div style={{ marginTop: 5, fontSize: 11, color: COLORS.red }}>
                                {searchError}
                            </div>
                        )}
                        {searchResults.length > 0 && (
                            <div style={{ marginTop: 6, maxHeight: 80, overflowY: "auto" }}>
                                {searchResults.slice(0, 5).map(r => (
                                    <button key={r.requestId} onClick={() => setSelectedRequestId(r.requestId)}
                                        style={{ display: "block", width: "100%", textAlign: "left",
                                            background: "transparent", border: "none", color: COLORS.blue,
                                            fontSize: 10, cursor: "pointer", padding: "2px 0" }}>
                                        {r.requestId.slice(0, 12)}… ({r.totalDurationMs}ms{r.errorCount > 0 ? " ERR" : ""})
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── metrics dashboard ──────────────────────────────── */}
                    <div style={{ padding: "0 14px 10px", flexShrink: 0, borderTop: `1px solid ${COLORS.border}` }}>
                        <MetricsDashboard report={metricsReport} loading={metricsLoading} error={metricsError} />
                    </div>

                    {/* ── alerts ─────────────────────────────────────────── */}
                    {alerts.length > 0 && (
                        <div style={{ padding: "8px 14px", borderTop: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.yellow, marginBottom: 6 }}>
                                ⚠ Alerts ({alerts.length})
                            </div>
                            {alerts.slice(0, 5).map((a, i) => (
                                <div key={`${a.requestId}-${a.rule}-${i}`} style={{
                                    fontSize: 10, marginBottom: 4, padding: "4px 8px", borderRadius: 6,
                                    background: a.severity === "ERROR" ? COLORS.red + "15" : COLORS.yellow + "15",
                                    color: a.severity === "ERROR" ? COLORS.red : COLORS.yellow,
                                    borderLeft: `2px solid ${a.severity === "ERROR" ? COLORS.red : COLORS.yellow}`,
                                }}>
                                    <strong>[{a.rule}]</strong> {a.message}
                                </div>
                            ))}
                        </div>
                    )}
                </aside>

                {/* ── MAIN PANEL ─────────────────────────────────────────── */}
                <main style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {!selectedTrace ? (
                        <div style={{
                            flex: 1, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", color: COLORS.muted,
                        }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>⬡</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}>
                                No request selected
                            </div>
                            <div style={{ fontSize: 12, color: COLORS.muted, textAlign: "center", maxWidth: 300 }}>
                                Trigger an API call, then click a request on the left to inspect its call tree.
                            </div>
                            <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                                {[
                                    { label: "GET /users/1",                  url: "/users/1" },
                                    { label: "GET /orders/1001/fulfillment",   url: "/orders/1001/fulfillment" },
                                ].map(({ label, url }) => (
                                    <SampleButton key={url} label={label} url={url} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                            {/* ── top toolbar ────────────────────────────── */}
                            <div style={{
                                padding: "10px 18px", borderBottom: `1px solid ${COLORS.border}`,
                                display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
                                background: COLORS.surface, flexWrap: "wrap",
                            }}>
                                <code style={{ fontSize: 11, color: COLORS.muted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {selectedRequestId}
                                </code>

                                {/* summary chips */}
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <Badge color={COLORS.blue} title="Total spans">{nodeCount} spans</Badge>
                                    {maxExecution != null && <Badge color={maxExecution > 1000 ? COLORS.red : maxExecution > 300 ? COLORS.orange : COLORS.green} title="Slowest single hop">{maxExecution}ms peak</Badge>}
                                    {(requestStats[selectedRequestId]?.errors || 0) > 0 &&
                                        <Badge color={COLORS.red}>{requestStats[selectedRequestId].errors} error{requestStats[selectedRequestId].errors>1?"s":""}</Badge>}
                                    {(requestStats[selectedRequestId]?.contention || 0) > 0 &&
                                        <Badge color={COLORS.purple} title="Contention risk nodes">contention</Badge>}
                                </div>

                                {/* view mode */}
                                <div style={{ display: "flex", gap: 4, background: COLORS.bg, borderRadius: 8, padding: 3 }}>
                                    {["tree","flame"].map(v => (
                                        <button key={v} onClick={() => setViewMode(v)} style={{
                                            padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                            cursor: "pointer", border: "none",
                                            background: viewMode === v ? COLORS.blue : "transparent",
                                            color: viewMode === v ? "#000" : COLORS.muted,
                                        }}>{v === "tree" ? "🌲 Tree" : "🔥 Flame"}</button>
                                    ))}
                                </div>

                                {/* compare */}
                                <select value={compareRequestId || ""} onChange={e => setCompareRequestId(e.target.value || null)} style={{
                                    fontSize: 11, background: COLORS.bg, color: COLORS.text,
                                    borderRadius: 8, border: `1px solid ${COLORS.border}`,
                                    padding: "4px 8px", outline: "none",
                                }}>
                                    <option value="">Compare: none</option>
                                    {requestIds.filter(id => id !== selectedRequestId).map(id => (
                                        <option key={id} value={id}>{id.slice(0, 16)}…</option>
                                    ))}
                                </select>

                                {/* exports */}
                                <div style={{ display: "flex", gap: 4 }}>
                                    {["json","svg","pdf"].map(fmt => (
                                        <a key={fmt} href={exportUrl(selectedRequestId, fmt)} target="_blank" rel="noreferrer" style={exportBtnStyle}>
                                            {fmt.toUpperCase()}
                                        </a>
                                    ))}
                                    <a href={otelExportUrl(selectedRequestId)} target="_blank" rel="noreferrer" style={exportBtnStyle} title="OpenTelemetry OTLP JSON">OTEL</a>
                                    <button onClick={async () => {
                                        try {
                                            const ref = await persistTrace(selectedRequestId);
                                            const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8080";
                                            setShareLink(`${base}${ref.sharePath}`);
                                        } catch { setShareLink(null); }
                                    }} style={exportBtnStyle}>Share</button>
                                </div>
                            </div>

                            {shareLink && (
                                <div style={{
                                    padding: "6px 18px", background: COLORS.blue + "15",
                                    borderBottom: `1px solid ${COLORS.blue}33`,
                                    display: "flex", alignItems: "center", gap: 8,
                                }}>
                                    <span style={{ fontSize: 11, color: COLORS.blue, flexShrink: 0 }}>Share link:</span>
                                    <input
                                        readOnly value={shareLink}
                                        onClick={e => e.target.select()}
                                        style={{
                                            flex: 1, fontSize: 11, background: "transparent",
                                            border: "none", color: COLORS.blue, outline: "none",
                                            fontFamily: "monospace", minWidth: 0,
                                        }}
                                    />
                                    <button onClick={() => {
                                        navigator.clipboard.writeText(shareLink).then(() => {
                                            setShareCopied(true);
                                            setTimeout(() => setShareCopied(false), 2000);
                                        });
                                    }} style={{
                                        padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                        border: `1px solid ${COLORS.blue}55`, background: COLORS.blue + "22",
                                        color: COLORS.blue, cursor: "pointer", flexShrink: 0,
                                    }}>
                                        {shareCopied ? "✓ Copied" : "Copy"}
                                    </button>
                                </div>
                            )}

                            {/* ── main content: tree / flame ──────────────── */}
                            <div style={{ flex: 1, overflow: "auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 12 }}>

                                {/* analysis hints banner */}
                                {analysisReport && (
                                    <AnalysisBanner report={analysisReport} />
                                )}

                                {/* visualisation */}
                                <div style={{
                                    borderRadius: 12, border: `1px solid ${COLORS.border}`,
                                    background: "radial-gradient(ellipse at top left,#0f172a,#080e1f)",
                                    overflow: "hidden", minHeight: 300,
                                }}>
                                    {viewMode === "tree" ? (
                                        <TraceTree
                                            data={selectedTrace}
                                            slowPathEventIds={slowPathEventIds}
                                            methodFilter={methodFilter}
                                            collapsedEventIds={collapsedEventIds}
                                            latestEvent={latestEvent}
                                            onNodeClick={node => {
                                                setSelectedNode(node);
                                                setNodeTab("info");
                                                const className = extractClassNameFromMethod(node?.methodName ?? node?.method);
                                                if (className) setCodePreview({ visible: true, className, lineNumber: node?.sourceLine > 0 ? node.sourceLine : 1 });
                                            }}
                                            onToggleCollapse={eventId => setCollapsedEventIds(prev => {
                                                const n = new Set(prev);
                                                n.has(eventId) ? n.delete(eventId) : n.add(eventId);
                                                return n;
                                            })}
                                        />
                                    ) : (
                                        <FlameGraph data={selectedTrace} />
                                    )}
                                </div>

                                {/* timeline */}
                                <RequestTimeline events={flatEvents} />

                                {/* selected node detail panel */}
                                {selectedNode && (
                                    <NodeDetailPanel
                                        node={selectedNode}
                                        maxExecution={maxExecution}
                                        tab={nodeTab}
                                        onTab={setNodeTab}
                                        onClose={() => setSelectedNode(null)}
                                        tabBtn={tabBtn}
                                    />
                                )}

                                {/* comparison section */}
                                {compareTrace && (
                                    <ComparisonSection
                                        selectedTrace={selectedTrace}
                                        compareTrace={compareTrace}
                                        selectedRequestId={selectedRequestId}
                                        compareRequestId={compareRequestId}
                                        flatEvents={flatEvents}
                                        compareFlatEvents={compareFlatEvents}
                                        diffReport={diffReport}
                                        diffLoading={diffLoading}
                                        analysisReport={analysisReport}
                                    />
                                )}

                                {/* persisted history */}
                                {historyTraces.length > 0 && (
                                    <div style={{ ...panelStyle, padding: "10px 14px" }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
                                            Persisted History ({historyTraces.length})
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 6 }}>
                                            {historyTraces.slice(0, 8).map(h => (
                                                <div key={h.shareId} style={{
                                                    padding: "6px 10px", borderRadius: 8,
                                                    background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                                                    fontSize: 10, color: COLORS.muted,
                                                }}>
                                                    <code style={{ color: COLORS.blue }}>{h.requestId.slice(0, 12)}…</code>
                                                    <span style={{ marginLeft: 6 }}>{h.totalDurationMs}ms</span>
                                                    {h.hasError && <Badge color={COLORS.red} style={{ marginLeft: 4 }}>ERR</Badge>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {codePreview.visible && (
                <CodePreview className={codePreview.className} lineNumber={codePreview.lineNumber}
                    onClose={() => setCodePreview({ visible: false, className: null, lineNumber: null })} />
            )}
        </div>
    );
}

const exportBtnStyle = {
    padding: "4px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`,
    background: COLORS.bg, color: COLORS.blue, fontSize: 10, cursor: "pointer",
    textDecoration: "none", display: "inline-block",
};

// ── relativeTime ─────────────────────────────────────────────────────────────
function relativeTime(ts, now) {
    if (!ts || !isFinite(ts)) return "";
    const sec = Math.floor((now - ts) / 1000);
    if (sec < 5)  return "just now";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    return `${Math.floor(min / 60)}h ago`;
}

// ── SampleButton ─────────────────────────────────────────────────────────────
function SampleButton({ label, url }) {
    const [state, setState] = React.useState("idle"); // idle | running | done | error
    const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8080";
    return (
        <button
            disabled={state === "running"}
            onClick={async () => {
                setState("running");
                try {
                    await fetch(base + url);
                    setState("done");
                } catch {
                    setState("error");
                } finally {
                    setTimeout(() => setState("idle"), 2500);
                }
            }}
            style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                cursor: state === "running" ? "wait" : "pointer",
                border: `1px solid ${state === "error" ? COLORS.red : state === "done" ? COLORS.green : COLORS.blue}55`,
                background: state === "error" ? COLORS.red + "15" : state === "done" ? COLORS.green + "15" : COLORS.blue + "15",
                color: state === "error" ? COLORS.red : state === "done" ? COLORS.green : COLORS.blue,
                transition: "all .2s",
            }}
        >
            {state === "running" ? "⏳ running…" : state === "done" ? "✓ done" : state === "error" ? "✕ failed" : label}
        </button>
    );
}
