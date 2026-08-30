import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { computeMetrics, flattenEvents, extractClassNameFromMethod, buildTracesFromEvents } from "./services/traceUtils";
import TraceTree from "./components/TraceTree";
import RequestTimeline from "./components/RequestTimeline";
import FlameGraph from "./components/FlameGraph";
import CodePreview from "./components/CodePreview";
import MetricsDashboard from "./components/MetricsDashboard";
import AnalysisBanner from "./components/AnalysisBanner";
import NodeDetailPanel from "./components/NodeDetailPanel";
import ComparisonSection from "./components/ComparisonSection";
import KpiBar from "./components/KpiBar";
import AlertRail from "./components/AlertRail";
import ExportDropdown from "./components/ExportDropdown";
import SqlInspector from "./components/SqlInspector";
import { useTraceStream } from "./hooks/useTraceStream";
import { useComparisonState } from "./hooks/useComparisonState";
import { useSearchAndMetrics } from "./hooks/useSearchAndMetrics";
import { COLORS, SHADOWS, GRADIENT, Badge, DurationBar, GlassCard, SectionLabel, NeoInput } from "./theme.jsx";

// ── health score ──────────────────────────────────────────────────────────────
function computeHealthGrade(stats) {
    if (!stats || stats.count === 0) return { grade: "—", color: COLORS.muted, score: null };
    let score = 100;
    if (stats.errors > 0)         score -= Math.min(stats.errors * 15, 40);
    if (stats.contention > 0)     score -= Math.min(stats.contention * 8, 20);
    if (stats.slow > 0)           score -= Math.min(stats.slow * 6, 20);
    if (stats.totalMs > 2000)     score -= 15;
    else if (stats.totalMs > 500) score -= 8;
    score = Math.max(0, score);
    if (score >= 90) return { grade: "A", color: COLORS.green,  score };
    if (score >= 75) return { grade: "B", color: "#4ade80",     score };
    if (score >= 60) return { grade: "C", color: COLORS.yellow, score };
    if (score >= 40) return { grade: "D", color: COLORS.orange, score };
    return { grade: "F", color: COLORS.red, score };
}

// ── mono label ────────────────────────────────────────────────────────────────
const MONO = "'JetBrains Mono', 'Fira Code', ui-monospace, monospace";

export default function App() {
    const { eventsByRequest, selectedRequestId, setSelectedRequestId, autoFollow, setAutoFollow, paused, setPaused, clearAll, latestEvent } = useTraceStream();

    const [sidebarTab, setSidebarTab]         = useState("requests");
    const [methodFilter, setMethodFilter]     = useState("");
    const [requestSearch, setRequestSearch]   = useState("");

    const [bookmarked, setBookmarked] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem("trace-bookmarks") || "[]")); }
        catch { return new Set(); }
    });
    const toggleBookmark = useCallback((rid, e) => {
        e.stopPropagation();
        setBookmarked(prev => {
            const n = new Set(prev);
            n.has(rid) ? n.delete(rid) : n.add(rid);
            localStorage.setItem("trace-bookmarks", JSON.stringify([...n]));
            return n;
        });
    }, []);

    const [collapsedEventIds, setCollapsedEventIds] = useState(new Set());
    const [selectedNode, setSelectedNode]     = useState(null);
    const [nodeTab, setNodeTab]               = useState("info");
    const [viewMode, setViewMode]             = useState("tree");
    const [codePreview, setCodePreview]       = useState({ visible: false, className: null, lineNumber: null });
    const [now, setNow]                       = useState(() => Date.now());
    const comparisonRef = useRef(null);
    const [traceSearchMethod, setTraceSearchMethod]         = useState("");
    const [traceSearchMinMs, setTraceSearchMinMs]           = useState("");
    const [traceSearchErrorsOnly, setTraceSearchErrorsOnly] = useState(false);

    const [eventsPerSec, setEventsPerSec] = useState(0);
    const eventTimestampsRef = useRef([]);
    useEffect(() => {
        if (!latestEvent) return;
        const t = Date.now();
        eventTimestampsRef.current.push(t);
        eventTimestampsRef.current = eventTimestampsRef.current.filter(x => t - x < 10000);
        setEventsPerSec(+(eventTimestampsRef.current.length / 10).toFixed(1));
    }, [latestEvent]);

    const { compareRequestId, setCompareRequestId, diffReport, diffLoading, analysisReport, reset: resetComparison } =
        useComparisonState(selectedRequestId);

    const { metricsReport, metricsLoading, metricsError, searchResults, searchError, historyTraces, alerts, latencyTimeseries } =
        useSearchAndMetrics(eventsByRequest, selectedRequestId, {
            method: traceSearchMethod, minMs: traceSearchMinMs, errorsOnly: traceSearchErrorsOnly,
        });

    const traces             = useMemo(() => buildTracesFromEvents(eventsByRequest), [eventsByRequest]);
    const selectedTrace      = selectedRequestId != null ? traces[selectedRequestId] : null;
    const compareTrace       = compareRequestId && traces[compareRequestId] ? traces[compareRequestId] : null;
    const { nodeCount, maxExecution, slowPathEventIds } = useMemo(() => computeMetrics(selectedTrace), [selectedTrace]);
    const flatEvents         = useMemo(() => selectedTrace ? flattenEvents(selectedTrace) : [], [selectedTrace]);
    const compareFlatEvents  = useMemo(() => compareTrace ? flattenEvents(compareTrace) : [], [compareTrace]);
    const requestIds         = Object.keys(traces);
    const filteredRequestIds = requestIds.filter(id => id.toLowerCase().includes(requestSearch.toLowerCase()));

    const handleClear = () => { clearAll(); resetComparison(); setSelectedNode(null); setCollapsedEventIds(new Set()); };

    // Auto-scroll the comparison panel into view when compare becomes active
    useEffect(() => {
        if (compareTrace && comparisonRef.current) {
            setTimeout(() => {
                comparisonRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 80);
        }
    }, [compareTrace]);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 15_000);
        return () => clearInterval(id);
    }, []);

    const requestStats = useMemo(() => {
        const out = {};
        for (const [rid, evts] of Object.entries(eventsByRequest)) {
            const errors     = evts.filter(e => e.status === "ERROR").length;
            const slow       = evts.filter(e => e.slowPath).length;
            const contention = evts.filter(e => e.contentionRisk).length;
            const sqlCount   = evts.filter(e => e.eventType === "SQL" || (e.method || "").startsWith("SQL:")).length;
            const threads    = new Set(evts.map(e => e.threadName).filter(Boolean)).size;
            const totalMs    = evts.reduce((s, e) => Math.max(s, e.executionTimeMs || 0), 0);
            const firstTs    = evts.reduce((min, e) => {
                const t = e.timestamp ? new Date(e.timestamp).getTime() : Infinity;
                return t < min ? t : min;
            }, Infinity);
            out[rid] = { errors, slow, contention, sqlCount, threads, totalMs, count: evts.length, firstTs };
        }
        return out;
    }, [eventsByRequest]);

    // derived stats for selected trace
    const selStats = selectedRequestId ? requestStats[selectedRequestId] : null;
    const selHealth = computeHealthGrade(selStats);

    // top 5 slowest spans for right rail
    const topSlowSpans = useMemo(() => {
        if (!flatEvents.length) return [];
        return [...flatEvents]
            .filter(e => e.executionTimeMs > 0)
            .sort((a, b) => (b.executionTimeMs || 0) - (a.executionTimeMs || 0))
            .slice(0, 6);
    }, [flatEvents]);

    // span type breakdown
    const spanBreakdown = useMemo(() => {
        if (!flatEvents.length) return [];
        const counts = {};
        for (const e of flatEvents) {
            const type = e.eventType || "METHOD";
            counts[type] = (counts[type] || 0) + 1;
        }
        const total = flatEvents.length;
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => ({
                type,
                count,
                pct: Math.round((count / total) * 100),
                color: type === "SQL" ? COLORS.blue : type === "ERROR" ? COLORS.red : COLORS.green,
            }));
    }, [flatEvents]);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div style={{
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            background: COLORS.bg,
            color: COLORS.text,
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
        }}>

            {/* ══════════════════════════════════════════════════════ HEADER */}
            <header style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
                height: 52,
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.glass,
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                flexShrink: 0,
                position: "relative",
                zIndex: 20,
            }}>
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 2,
                    background: GRADIENT.brand,
                }} />

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 9,
                        background: GRADIENT.brand,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, fontWeight: 900, color: "#fff", flexShrink: 0,
                        boxShadow: `0 0 14px rgba(56,189,248,0.4)`,
                    }}>T</div>
                    <div>
                        <div style={{
                            fontWeight: 800, fontSize: 13.5, letterSpacing: -0.3,
                            background: GRADIENT.brand,
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        }}>Live Execution Trace</div>
                        <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: 0.2 }}>
                            Spring Boot · Real-time Observability
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                    {!paused && (
                        <div style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "3px 10px", borderRadius: 20,
                            background: `${COLORS.green}12`,
                            border: `1px solid ${COLORS.green}30`,
                        }}>
                            <span style={{
                                width: 6, height: 6, borderRadius: "50%",
                                background: COLORS.green, boxShadow: `0 0 7px ${COLORS.green}`,
                                animation: "pulse 1.5s infinite", flexShrink: 0,
                            }} />
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.green, fontFamily: MONO, letterSpacing: 0.5 }}>
                                {autoFollow ? "LIVE · AUTO" : "LIVE"}
                            </span>
                            {eventsPerSec > 0 && (
                                <span style={{ fontSize: 10, color: COLORS.muted, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                                    {eventsPerSec}/s
                                </span>
                            )}
                        </div>
                    )}
                    {!autoFollow && !paused && (
                        <button onClick={() => setAutoFollow(true)} style={{
                            padding: "3px 10px", borderRadius: 20,
                            background: `${COLORS.blue}12`, border: `1px solid ${COLORS.blue}30`,
                            color: COLORS.blue, fontSize: 10.5, fontWeight: 700,
                            cursor: "pointer", fontFamily: MONO,
                        }} title="Click to auto-follow new traces again">⟳ Follow latest</button>
                    )}
                    {alerts.length > 0 && (
                        <div style={{
                            padding: "3px 10px", borderRadius: 20,
                            background: `${COLORS.red}18`, border: `1px solid ${COLORS.red}40`,
                            color: COLORS.red, fontSize: 10.5, fontWeight: 700,
                            boxShadow: `0 0 10px ${COLORS.redGlow}`,
                            animation: "pulse 2s infinite", fontFamily: MONO,
                        }}>⚠ {alerts.length} alert{alerts.length > 1 ? "s" : ""}</div>
                    )}
                    <button onClick={() => setPaused(p => !p)} style={{
                        padding: "5px 14px", borderRadius: 7,
                        border: `1px solid ${paused ? COLORS.green + "55" : COLORS.borderMid}`,
                        background: paused ? `${COLORS.green}15` : COLORS.surfaceMid,
                        color: paused ? COLORS.green : COLORS.textSoft,
                        fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3,
                    }}>{paused ? "▶ Resume" : "⏸ Pause"}</button>
                    <button onClick={handleClear} style={{
                        padding: "5px 14px", borderRadius: 7,
                        border: `1px solid ${COLORS.border}`, background: COLORS.surfaceMid,
                        color: COLORS.muted, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}>✕ Clear</button>
                </div>
            </header>

            {/* ══════════════════════════════════════════════════════ KPI BAR */}
            <KpiBar metricsReport={metricsReport} requestStats={requestStats} alerts={alerts} totalRequests={requestIds.length} />

            {/* ══════════════════════════════════════════════════════ BODY — 3 columns */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "260px 1fr 280px",
                flex: 1,
                overflow: "hidden",
                minHeight: 0,
            }}>

                {/* ════════════════════════════ LEFT SIDEBAR */}
                <aside style={{
                    borderRight: `1px solid ${COLORS.border}`,
                    display: "flex", flexDirection: "column",
                    overflow: "hidden", background: COLORS.surface,
                }}>
                    {/* tab bar */}
                    <div style={{
                        display: "flex", borderBottom: `1px solid ${COLORS.border}`,
                        padding: "0 6px", gap: 2, flexShrink: 0,
                    }}>
                        {[
                            { id: "requests", label: "Traces", badge: requestIds.length || null },
                            { id: "search",   label: "Search" },
                        ].map(t => {
                            const active = sidebarTab === t.id;
                            return (
                                <button key={t.id} onClick={() => setSidebarTab(t.id)} style={{
                                    flex: 1, padding: "10px 4px 9px",
                                    border: "none",
                                    borderBottom: active ? `2px solid ${COLORS.blue}` : "2px solid transparent",
                                    background: "transparent",
                                    color: active ? COLORS.blue : COLORS.muted,
                                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                                    letterSpacing: 0.4, transition: "color .15s",
                                }}>
                                    {t.label}
                                    {t.badge > 0 && (
                                        <span style={{
                                            padding: "0px 5px", borderRadius: 8, fontSize: 9, fontWeight: 800,
                                            background: active ? COLORS.blue : `${COLORS.muted}33`,
                                            color: active ? "#000" : COLORS.muted,
                                            fontFamily: MONO,
                                        }}>{t.badge}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── TRACES TAB ── */}
                    {sidebarTab === "requests" && (
                        <>
                            <div style={{ padding: "8px 10px 4px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                                <NeoInput
                                    placeholder="🔍  Search request IDs…"
                                    value={requestSearch}
                                    onChange={e => setRequestSearch(e.target.value)}
                                />
                                <NeoInput
                                    placeholder="Filter methods in tree…"
                                    value={methodFilter}
                                    onChange={e => setMethodFilter(e.target.value)}
                                />
                            </div>
                            <div style={{
                                padding: "4px 12px 6px",
                                display: "flex", justifyContent: "space-between", flexShrink: 0,
                            }}>
                                <span style={{ fontSize: 9.5, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, fontFamily: MONO }}>
                                    Active Traces
                                </span>
                                <span style={{ fontSize: 9.5, fontWeight: 700, color: requestIds.length > 0 ? COLORS.blue : COLORS.muted, fontFamily: MONO }}>
                                    {requestIds.length} live
                                </span>
                            </div>

                            <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 10px" }}>
                                {filteredRequestIds.length === 0 && (
                                    <div style={{ margin: "24px 4px", color: COLORS.muted, fontSize: 11.5, textAlign: "center", lineHeight: 1.8 }}>
                                        <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.2 }}>◌</div>
                                        No traces yet.<br />
                                        <span style={{ fontSize: 10.5 }}>Start your Spring Boot app and hit an endpoint.</span>
                                    </div>
                                )}
                                {filteredRequestIds.map(rid => {
                                    const isSelected   = rid === selectedRequestId;
                                    const stats        = requestStats[rid] || {};
                                    const hasError     = stats.errors > 0;
                                    const isBookmarked = bookmarked.has(rid);
                                    const health       = computeHealthGrade(stats);

                                    return (
                                        <button key={rid} onClick={() => setSelectedRequestId(rid)} style={{
                                            display: "block", width: "100%", textAlign: "left",
                                            padding: "9px 10px", marginBottom: 4, borderRadius: 10,
                                            border: `1px solid ${isSelected ? COLORS.borderBright : hasError ? `${COLORS.red}40` : COLORS.border}`,
                                            background: isSelected ? `${COLORS.blue}12` : COLORS.surfaceHi,
                                            cursor: "pointer",
                                            transition: "border-color .15s, background .15s",
                                            boxShadow: isSelected ? SHADOWS.glass : "none",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                                                <code style={{
                                                    fontSize: 9.5, color: isSelected ? COLORS.blue : COLORS.textSoft,
                                                    wordBreak: "break-all", lineHeight: 1.5, flex: 1, fontFamily: MONO,
                                                }}>{rid}</code>
                                                <span style={{
                                                    padding: "2px 6px", borderRadius: 5, fontSize: 10.5, fontWeight: 900,
                                                    background: `${health.color}22`, color: health.color,
                                                    border: `1px solid ${health.color}44`,
                                                    boxShadow: `0 0 7px ${health.color}28`,
                                                    flexShrink: 0, fontFamily: MONO,
                                                }}>{health.grade}</span>
                                                <span onClick={e => toggleBookmark(rid, e)} style={{
                                                    fontSize: 12, color: isBookmarked ? COLORS.yellow : COLORS.muted,
                                                    cursor: "pointer", flexShrink: 0,
                                                }}>{isBookmarked ? "★" : "☆"}</span>
                                            </div>
                                            <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                                                <span style={{ fontSize: 9.5, color: stats.totalMs > 1000 ? COLORS.orange : COLORS.muted, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                                                    {stats.totalMs}ms
                                                </span>
                                                <span style={{ fontSize: 9, color: COLORS.muted }}>·</span>
                                                <span style={{ fontSize: 9.5, color: COLORS.muted, fontFamily: MONO }}>{stats.count} spans</span>
                                                {stats.sqlCount > 0 && (
                                                    <>
                                                        <span style={{ fontSize: 9, color: COLORS.muted }}>·</span>
                                                        <span style={{ fontSize: 9.5, color: COLORS.blue, fontFamily: MONO }}>{stats.sqlCount} SQL</span>
                                                    </>
                                                )}
                                                <span style={{ fontSize: 9, color: COLORS.muted }}>·</span>
                                                <span style={{ fontSize: 9.5, color: COLORS.muted }}>{relativeTime(stats.firstTs, now)}</span>
                                                {hasError && <Badge color={COLORS.red}>{stats.errors} ERR</Badge>}
                                                {stats.slow > 0 && <Badge color={COLORS.orange}>{stats.slow} SLOW</Badge>}
                                                {stats.contention > 0 && <Badge color={COLORS.purple}>CONT</Badge>}
                                            </div>
                                            <DurationBar ms={stats.totalMs} maxMs={maxExecution || stats.totalMs} />
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* ── SEARCH TAB ── */}
                    {sidebarTab === "search" && (
                        <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
                            <SectionLabel>Trace Search</SectionLabel>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                                <NeoInput placeholder="Method name…" value={traceSearchMethod} onChange={e => setTraceSearchMethod(e.target.value)} />
                                <NeoInput type="number" placeholder="Min duration (ms)" value={traceSearchMinMs} onChange={e => setTraceSearchMinMs(e.target.value)} />
                                <label style={{ fontSize: 11, color: COLORS.muted, display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}>
                                    <input type="checkbox" checked={traceSearchErrorsOnly} onChange={e => setTraceSearchErrorsOnly(e.target.checked)} style={{ accentColor: COLORS.red }} />
                                    Errors only
                                </label>
                            </div>
                            {searchError && (
                                <div style={{ fontSize: 10.5, color: COLORS.red, padding: "5px 9px", borderRadius: 6, background: `${COLORS.red}12`, border: `1px solid ${COLORS.red}28`, marginBottom: 8 }}>{searchError}</div>
                            )}
                            {searchResults.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                    <SectionLabel right={`${searchResults.length}`}>Results</SectionLabel>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        {searchResults.slice(0, 10).map(r => (
                                            <button key={r.requestId} onClick={() => setSelectedRequestId(r.requestId)} style={{
                                                display: "block", width: "100%", textAlign: "left",
                                                padding: "7px 10px", borderRadius: 8,
                                                background: r.requestId === selectedRequestId ? `${COLORS.blue}18` : COLORS.surfaceHi,
                                                border: `1px solid ${r.requestId === selectedRequestId ? COLORS.borderBright : COLORS.border}`,
                                                cursor: "pointer",
                                            }}>
                                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                    <code style={{ fontSize: 9.5, color: COLORS.blue, fontFamily: MONO }}>{r.requestId.slice(0, 13)}…</code>
                                                    <span style={{ fontSize: 9.5, color: COLORS.muted, fontFamily: MONO }}>{r.totalDurationMs}ms</span>
                                                </div>
                                                {r.errorCount > 0 && <div style={{ marginTop: 3 }}><Badge color={COLORS.red}>{r.errorCount} ERR</Badge></div>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {historyTraces.length > 0 && (
                                <div>
                                    <SectionLabel right={`${historyTraces.length}`}>History</SectionLabel>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        {historyTraces.slice(0, 6).map(h => (
                                            <div key={h.shareId} style={{
                                                padding: "6px 10px", borderRadius: 8,
                                                background: COLORS.surfaceHi, border: `1px solid ${COLORS.border}`,
                                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                            }}>
                                                <code style={{ fontSize: 9.5, color: COLORS.blue, fontFamily: MONO }}>{h.requestId.slice(0, 12)}…</code>
                                                <div style={{ display: "flex", gap: 5 }}>
                                                    <span style={{ fontSize: 9.5, color: COLORS.muted, fontFamily: MONO }}>{h.totalDurationMs}ms</span>
                                                    {h.hasError && <Badge color={COLORS.red}>ERR</Badge>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* alerts dock */}
                    {alerts.length > 0 && (
                        <div style={{ padding: "8px 10px 10px", borderTop: `1px solid ${COLORS.border}`, flexShrink: 0, background: `${COLORS.red}06` }}>
                            <div style={{ fontSize: 9.5, fontWeight: 800, color: COLORS.yellow, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1, fontFamily: MONO }}>
                                ⚠ {alerts.length} Alert{alerts.length > 1 ? "s" : ""}
                            </div>
                            {alerts.slice(0, 3).map((a) => (
                                <div key={a.id} style={{
                                    fontSize: 10, marginBottom: 3, padding: "4px 7px", borderRadius: 6,
                                    background: a.severity === "ERROR" ? `${COLORS.red}10` : `${COLORS.yellow}0c`,
                                    color: a.severity === "ERROR" ? COLORS.red : COLORS.yellow,
                                    borderLeft: `2px solid ${a.severity === "ERROR" ? COLORS.red : COLORS.yellow}`,
                                    lineHeight: 1.45,
                                }}>
                                    <strong>[{a.rule}]</strong> {a.message}
                                </div>
                            ))}
                        </div>
                    )}
                </aside>

                {/* ════════════════════════════ CENTRE — trace view */}
                <main style={{ display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
                    {!selectedTrace ? (
                        <EmptyState />
                    ) : (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                            {/* alert rail */}
                            <AlertRail alerts={alerts} />

                            {/* ── Trace summary header bar ── */}
                            <TraceSummaryBar
                                selectedRequestId={selectedRequestId}
                                selStats={selStats}
                                selHealth={selHealth}
                                nodeCount={nodeCount}
                                maxExecution={maxExecution}
                                viewMode={viewMode}
                                setViewMode={setViewMode}
                                compareRequestId={compareRequestId}
                                setCompareRequestId={setCompareRequestId}
                                requestIds={requestIds}
                                onScrollToCompare={() => comparisonRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                            />

                            {/* ── Span stats mini-row ── */}
                            <SpanStatsMiniRow flatEvents={flatEvents} selStats={selStats} maxExecution={maxExecution} spanBreakdown={spanBreakdown} />

                            {/* scrollable content */}
                            <div style={{ flex: 1, overflow: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>

                                {/* visualisation */}
                                <div style={{
                                    borderRadius: 12, border: `1px solid ${COLORS.borderMid}`,
                                    background: "radial-gradient(ellipse at 20% 20%, #0d1e38 0%, #070f1f 60%, #050c1a 100%)",
                                    overflow: "hidden",
                                    flexShrink: 0,
                                    boxShadow: SHADOWS.glass,
                                    /* Tree: natural SVG height (≥460px set by D3).
                                       Flame: fixed 440px with internal scroll. */
                                    height: viewMode === "flame" ? 440 : undefined,
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
                                                const cn = extractClassNameFromMethod(node?.methodName ?? node?.method);
                                                if (cn) setCodePreview({ visible: true, className: cn, lineNumber: node?.sourceLine > 0 ? node.sourceLine : 1 });
                                            }}
                                            onToggleCollapse={eventId => setCollapsedEventIds(prev => {
                                                const n = new Set(prev); n.has(eventId) ? n.delete(eventId) : n.add(eventId); return n;
                                            })}
                                        />
                                    ) : (
                                        <FlameGraph data={selectedTrace} />
                                    )}
                                </div>

                                {/* thread timeline */}
                                <RequestTimeline events={flatEvents} />

                                {/* node detail */}
                                {selectedNode && (
                                    <NodeDetailPanel
                                        node={selectedNode}
                                        maxExecution={maxExecution}
                                        tab={nodeTab}
                                        onTab={setNodeTab}
                                        onClose={() => setSelectedNode(null)}
                                        flatEvents={flatEvents}
                                    />
                                )}

                                {/* comparison section */}
                                {compareTrace && (
                                    <div ref={comparisonRef}>
                                        <ComparisonSection
                                            selectedTrace={selectedTrace}
                                            compareTrace={compareTrace}
                                            selectedRequestId={selectedRequestId}
                                            compareRequestId={compareRequestId}
                                            flatEvents={flatEvents}
                                            compareFlatEvents={compareFlatEvents}
                                            diffReport={diffReport}
                                            diffLoading={diffLoading}
                                        />
                                    </div>
                                )}

                                {/* SQL inspector */}
                                {flatEvents.some(e => e.eventType === "SQL" || (e.method || "").startsWith("SQL:")) && (
                                    <div style={{
                                        borderRadius: 12, border: `1px solid ${COLORS.borderMid}`,
                                        background: COLORS.glass, backdropFilter: "blur(10px)",
                                        overflow: "hidden", boxShadow: SHADOWS.glass,
                                    }}>
                                        <div style={{
                                            padding: "8px 14px", borderBottom: `1px solid ${COLORS.border}`,
                                            display: "flex", alignItems: "center", gap: 8,
                                        }}>
                                            <span style={{
                                                padding: "2px 8px", borderRadius: 4, fontSize: 9.5, fontWeight: 800,
                                                background: `${COLORS.blue}22`, color: COLORS.blue,
                                                border: `1px solid ${COLORS.blue}44`, fontFamily: MONO, letterSpacing: 0.5,
                                            }}>SQL</span>
                                            <span style={{ fontWeight: 700, fontSize: 12, color: COLORS.textSoft }}>Query Inspector</span>
                                            <ExportDropdown requestId={selectedRequestId} style={{ marginLeft: "auto" }} />
                                        </div>
                                        <div style={{ padding: "12px 14px" }}>
                                            <SqlInspector flatEvents={flatEvents} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>

                {/* ════════════════════════════ RIGHT INSIGHT RAIL */}
                <aside style={{
                    borderLeft: `1px solid ${COLORS.border}`,
                    display: "flex", flexDirection: "column",
                    overflow: "hidden", background: COLORS.surface,
                    minWidth: 0,
                }}>
                    <div style={{
                        padding: "9px 14px 8px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        fontSize: 10, fontWeight: 800, color: COLORS.muted,
                        textTransform: "uppercase", letterSpacing: 1.1, fontFamily: MONO,
                        flexShrink: 0,
                        background: COLORS.glass, backdropFilter: "blur(8px)",
                    }}>
                        Insights
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 14 }}>

                        {!selectedTrace && (
                            <div style={{ color: COLORS.muted, fontSize: 11.5, textAlign: "center", marginTop: 24, lineHeight: 1.8 }}>
                                Select a trace to see<br />live insights here.
                            </div>
                        )}

                        {/* ── Root Cause Analysis ── */}
                        {analysisReport && <AnalysisBanner report={analysisReport} />}

                        {/* ── Top Slowest Spans ── */}
                        {topSlowSpans.length > 0 && (
                            <div>
                                <SectionLabel right={`top ${topSlowSpans.length}`}>Slowest Spans</SectionLabel>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    {topSlowSpans.map((span, i) => {
                                        const ms = span.executionTimeMs || 0;
                                        const color = ms > 500 ? COLORS.red : ms > 100 ? COLORS.orange : COLORS.green;
                                        const pct = maxExecution > 0 ? Math.min(ms / maxExecution, 1) : 0;
                                        const raw = span.methodName || span.method || "?";
                                        // If it looks like a Java method (contains dots but not spaces), take last segment
                                        const name = raw.includes(".") && !raw.includes(" ")
                                            ? raw.replace(/\(.*\)$/, "").split(".").pop() + (raw.includes("(") ? "()" : "")
                                            : raw.length > 36 ? raw.slice(0, 36) + "…" : raw;
                                        return (
                                            <div key={i} style={{
                                                padding: "7px 9px", borderRadius: 8,
                                                background: COLORS.surfaceHi,
                                                border: `1px solid ${color}20`,
                                            }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                                                    <span style={{
                                                        fontSize: 10.5, color: COLORS.text,
                                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                        maxWidth: "70%", fontWeight: 600,
                                                    }} title={span.methodName || span.method}>{name}</span>
                                                    <span style={{
                                                        fontSize: 10.5, fontWeight: 800, color,
                                                        fontFamily: MONO, fontVariantNumeric: "tabular-nums",
                                                        textShadow: `0 0 10px ${color}55`,
                                                    }}>{ms}ms</span>
                                                </div>
                                                {/* inline bar */}
                                                <div style={{ height: 3, borderRadius: 99, background: `${COLORS.blue}0c` }}>
                                                    <div style={{
                                                        width: `${pct * 100}%`, height: "100%", borderRadius: 99,
                                                        background: `linear-gradient(90deg, ${color}88, ${color})`,
                                                        boxShadow: `0 0 5px ${color}66`,
                                                        transition: "width 0.4s ease",
                                                    }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── Span Type Breakdown ── */}
                        {spanBreakdown.length > 0 && (
                            <div>
                                <SectionLabel right={`${flatEvents.length} total`}>Span Breakdown</SectionLabel>
                                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                    {spanBreakdown.map(({ type, count, pct, color }) => (
                                        <div key={type}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                                <span style={{ fontSize: 10.5, color: COLORS.textSoft, fontFamily: MONO }}>{type}</span>
                                                <span style={{ fontSize: 10.5, color: COLORS.muted, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                                                    {count} <span style={{ color: color, fontWeight: 700 }}>{pct}%</span>
                                                </span>
                                            </div>
                                            <div style={{ height: 4, borderRadius: 99, background: `${COLORS.blue}0a` }}>
                                                <div style={{
                                                    width: `${pct}%`, height: "100%", borderRadius: 99,
                                                    background: `linear-gradient(90deg, ${color}66, ${color})`,
                                                    transition: "width 0.4s ease",
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Method Metrics — computed locally from streamed events, sparklines from timeseries ── */}
                        {flatEvents.length > 0 && <LocalMethodMetrics flatEvents={flatEvents} latencyTimeseries={latencyTimeseries} />}

                        {/* spacer */}
                        <div style={{ height: 8 }} />
                    </div>
                </aside>
            </div>

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

// ── TraceSummaryBar ───────────────────────────────────────────────────────────
function TraceSummaryBar({ selectedRequestId, selStats, selHealth, nodeCount, maxExecution, viewMode, setViewMode, compareRequestId, setCompareRequestId, requestIds, onScrollToCompare }) {
    return (
        <div style={{
            padding: "7px 14px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
            background: COLORS.glass, backdropFilter: "blur(10px)",
            flexWrap: "wrap",
        }}>
            {/* request id chip */}
            <code style={{
                fontSize: 10, color: COLORS.blue,
                flex: 1, minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontFamily: MONO,
                background: `${COLORS.blue}0e`, padding: "3px 9px", borderRadius: 6,
                border: `1px solid ${COLORS.blue}22`,
            }}>{selectedRequestId}</code>

            {/* health badge */}
            {selHealth.score != null && (
                <div style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "3px 9px", borderRadius: 7,
                    background: `${selHealth.color}15`,
                    border: `1px solid ${selHealth.color}44`,
                }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: selHealth.color, fontFamily: MONO }}>
                        {selHealth.grade}
                    </span>
                    <span style={{ fontSize: 10, color: selHealth.color + "99", fontFamily: MONO }}>
                        {selHealth.score}
                    </span>
                </div>
            )}

            {/* summary chips */}
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                <Badge color={COLORS.blue}>{nodeCount} spans</Badge>
                {maxExecution != null && (
                    <Badge color={maxExecution > 1000 ? COLORS.red : maxExecution > 300 ? COLORS.orange : COLORS.green}>
                        {maxExecution}ms peak
                    </Badge>
                )}
                {(selStats?.errors || 0) > 0 && <Badge color={COLORS.red}>{selStats.errors} err</Badge>}
                {(selStats?.slow || 0) > 0 && <Badge color={COLORS.orange}>{selStats.slow} slow</Badge>}
                {(selStats?.sqlCount || 0) > 0 && <Badge color={COLORS.blue}>{selStats.sqlCount} SQL</Badge>}
                {(selStats?.contention || 0) > 0 && <Badge color={COLORS.purple}>contention</Badge>}
            </div>

            {/* active compare chip — visible tap target to jump to comparison panel */}
            {compareRequestId && (
                <button onClick={onScrollToCompare} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "3px 9px", borderRadius: 7,
                    background: `${COLORS.purple}18`,
                    border: `1px solid ${COLORS.purple}44`,
                    cursor: "pointer",
                }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: COLORS.purple, fontFamily: MONO }}>DIFF</span>
                    <span style={{ fontSize: 9.5, color: COLORS.purple + "aa", fontFamily: MONO, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        vs {compareRequestId.slice(0, 8)}…
                    </span>
                    <span style={{ fontSize: 10, color: COLORS.purple }}>↓</span>
                </button>
            )}

            {/* view toggle */}
            <div style={{ display: "flex", gap: 2, background: COLORS.bg, borderRadius: 7, padding: 3, border: `1px solid ${COLORS.border}` }}>
                {["tree", "flame"].map(v => {
                    const active = viewMode === v;
                    return (
                        <button key={v} onClick={() => setViewMode(v)} style={{
                            padding: "3px 11px", borderRadius: 5, fontSize: 10.5, fontWeight: 700,
                            cursor: "pointer", border: "none",
                            background: active ? COLORS.blue : "transparent",
                            color: active ? "#000" : COLORS.muted,
                            transition: "background .15s",
                        }}>{v === "tree" ? "🌲 Tree" : "🔥 Flame"}</button>
                    );
                })}
            </div>

            {/* compare select */}
            <select value={compareRequestId || ""} onChange={e => setCompareRequestId(e.target.value || null)} style={{
                fontSize: 10.5, background: COLORS.surfaceMid, color: COLORS.textSoft,
                borderRadius: 7, border: `1px solid ${compareRequestId ? COLORS.purple : COLORS.border}`,
                padding: "4px 7px", outline: "none", fontFamily: MONO,
            }}>
                <option value="">Compare: none</option>
                {requestIds.filter(id => id !== selectedRequestId).map(id => (
                    <option key={id} value={id}>{id.slice(0, 14)}…</option>
                ))}
            </select>

            <ExportDropdown requestId={selectedRequestId} />
        </div>
    );
}

// ── SpanStatsMiniRow ──────────────────────────────────────────────────────────
function SpanStatsMiniRow({ flatEvents, selStats, maxExecution, spanBreakdown }) {
    if (!flatEvents.length) return null;

    const sqlSpans     = flatEvents.filter(e => e.eventType === "SQL" || (e.method || "").startsWith("SQL:"));
    const errorSpans   = flatEvents.filter(e => e.status === "ERROR" || e.hasError);
    const slowSpans    = flatEvents.filter(e => e.slowPath);
    const critPathSpans = flatEvents.filter(e => e.isOnCriticalPath);
    const totalMs      = selStats?.totalMs || 0;

    const items = [
        { label: "Total Duration", value: `${totalMs}ms`, color: totalMs > 1000 ? COLORS.red : totalMs > 300 ? COLORS.orange : COLORS.green },
        { label: "Spans", value: flatEvents.length, color: COLORS.blue },
        { label: "Errors", value: errorSpans.length, color: errorSpans.length > 0 ? COLORS.red : COLORS.muted },
        { label: "Slow Paths", value: slowSpans.length, color: slowSpans.length > 0 ? COLORS.orange : COLORS.muted },
        { label: "SQL Queries", value: sqlSpans.length, color: sqlSpans.length > 0 ? COLORS.cyan : COLORS.muted },
        { label: "Critical Path", value: critPathSpans.length, color: critPathSpans.length > 0 ? COLORS.blue : COLORS.muted },
        { label: "Threads", value: selStats?.threads || 0, color: COLORS.purple },
        { label: "Peak Span", value: maxExecution != null ? `${maxExecution}ms` : "—", color: maxExecution > 500 ? COLORS.red : COLORS.green },
    ];

    return (
        <div style={{
            display: "flex",
            borderBottom: `1px solid ${COLORS.border}`,
            flexShrink: 0,
            background: "rgba(5,12,26,0.55)",
            overflowX: "auto",
        }}>
            {items.map((item, i) => (
                <div key={item.label} style={{
                    padding: "7px 16px",
                    borderRight: i < items.length - 1 ? `1px solid ${COLORS.border}` : "none",
                    flexShrink: 0,
                    textAlign: "center",
                    minWidth: 70,
                }}>
                    <div style={{
                        fontSize: 15, fontWeight: 800, color: item.color,
                        fontFamily: MONO, fontVariantNumeric: "tabular-nums", lineHeight: 1,
                        textShadow: `0 0 12px ${item.color}44`,
                    }}>{item.value}</div>
                    <div style={{
                        fontSize: 9, color: COLORS.muted, marginTop: 3,
                        textTransform: "uppercase", letterSpacing: 0.7,
                        fontFamily: MONO,
                    }}>{item.label}</div>
                </div>
            ))}
        </div>
    );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
function EmptyState() {
    const features = [
        { icon: "🌲", color: COLORS.green,  title: "Live Call Tree",      body: "Watch every method invocation appear in real-time as a navigable call graph." },
        { icon: "🔥", color: COLORS.orange, title: "Flame Graph",         body: "Click-to-zoom flame chart with hotspot ranking and critical path highlighting." },
        { icon: "📊", color: COLORS.blue,   title: "Statistical Metrics", body: "p50, p95, p99 latency per method with anomaly detection and N+1 warnings." },
        { icon: "🧵", color: COLORS.purple, title: "Thread Timeline",     body: "Swimlane view of every thread with zoom, pan, and colour-coded span types." },
        { icon: "⚡", color: COLORS.yellow, title: "Root-Cause Analysis", body: "Automated hints surfaced from execution patterns, contention, and SQL queries." },
        { icon: "🔀", color: COLORS.cyan,   title: "Trace Diff",          body: "Compare any two requests side-by-side with added, removed, and timing deltas." },
    ];
    return (
        <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "40px 24px",
            background: "radial-gradient(ellipse at 50% 30%, rgba(56,189,248,0.04) 0%, transparent 60%)",
            animation: "fadeIn .4s ease",
        }}>
            <div style={{
                width: 62, height: 62, borderRadius: 16,
                background: GRADIENT.brand,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 30, fontWeight: 900, color: "#fff", marginBottom: 18,
                boxShadow: `0 0 40px rgba(56,189,248,0.28), 0 0 80px rgba(34,211,160,0.1)`,
            }}>T</div>
            <div style={{
                fontSize: 20, fontWeight: 800, marginBottom: 8, textAlign: "center",
                background: GRADIENT.brand, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Live Execution Trace Visualizer</div>
            <div style={{ fontSize: 12.5, color: COLORS.muted, textAlign: "center", maxWidth: 380, marginBottom: 32, lineHeight: 1.75 }}>
                Fire a request to your instrumented Spring Boot app and watch every method call appear in real-time.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 32, width: "100%", maxWidth: 580 }}>
                {features.map(f => (
                    <div key={f.title} style={{
                        padding: "14px 14px 12px", borderRadius: 11,
                        border: `1px solid ${f.color}20`, background: COLORS.surfaceHi,
                    }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: `${f.color}18`, border: `1px solid ${f.color}28`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 16, marginBottom: 8,
                        }}>{f.icon}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{f.title}</div>
                        <div style={{ fontSize: 10.5, color: COLORS.muted, lineHeight: 1.6 }}>{f.body}</div>
                    </div>
                ))}
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.muted, marginBottom: 12 }}>Trigger a sample request:</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                {[
                    { label: "GET /users/1",                 url: "/users/1" },
                    { label: "GET /orders/1001/fulfillment", url: "/orders/1001/fulfillment" },
                ].map(({ label, url }) => <SampleButton key={url} label={label} url={url} />)}
            </div>
        </div>
    );
}

// ── relativeTime ──────────────────────────────────────────────────────────────
function relativeTime(ts, now) {
    if (!ts || !isFinite(ts)) return "";
    const sec = Math.floor((now - ts) / 1000);
    if (sec < 5)  return "just now";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    return `${Math.floor(min / 60)}h ago`;
}

// ── SampleButton ──────────────────────────────────────────────────────────────
function SampleButton({ label, url }) {
    const [state, setState] = React.useState("idle");
    const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8080";
    return (
        <button
            disabled={state === "running"}
            onClick={async () => {
                setState("running");
                try { await fetch(base + url); setState("done"); }
                catch { setState("error"); }
                finally { setTimeout(() => setState("idle"), 2500); }
            }}
            style={{
                padding: "9px 20px", borderRadius: 9, fontSize: 12, fontWeight: 700,
                cursor: state === "running" ? "wait" : "pointer",
                border: `1px solid ${state === "error" ? COLORS.red : state === "done" ? COLORS.green : COLORS.blue}55`,
                background: `${state === "error" ? COLORS.red : state === "done" ? COLORS.green : COLORS.blue}18`,
                color: state === "error" ? COLORS.red : state === "done" ? COLORS.green : COLORS.blue,
                transition: "all .2s", fontFamily: MONO, letterSpacing: 0.3,
                boxShadow: state === "done" ? `0 0 14px ${COLORS.greenGlow}` : state === "error" ? `0 0 14px ${COLORS.redGlow}` : "none",
            }}
        >
            {state === "running" ? "⏳ running…" : state === "done" ? "✓ done" : state === "error" ? "✕ failed" : label}
        </button>
    );
}

// ── Tiny SVG sparkline (pure SVG, no deps) ────────────────────────────────────
function Sparkline({ values, color, width = 52, height = 20 }) {
    if (!values || values.length < 2) return (
        <svg width={width} height={height} style={{ opacity: 0.3 }}>
            <line x1={0} y1={height / 2} x2={width} y2={height / 2}
                stroke={color} strokeWidth={1} strokeDasharray="2 2" />
        </svg>
    );
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 2) - 1;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    // Last point dot
    const [lx, ly] = pts[pts.length - 1].split(",");
    return (
        <svg width={width} height={height} style={{ overflow: "visible" }}>
            <polyline
                points={pts.join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={1.4}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.8}
            />
            <circle cx={lx} cy={ly} r={2} fill={color} />
        </svg>
    );
}

function LocalMethodMetrics({ flatEvents, latencyTimeseries }) {
    const rows = React.useMemo(() => {
        const map = {};
        for (const e of flatEvents) {
            const key = e.methodName || e.method || "unknown";
            if (!map[key]) map[key] = { count: 0, totalMs: 0, maxMs: 0, errors: 0 };
            const ms = e.executionTimeMs || 0;
            map[key].count++;
            map[key].totalMs += ms;
            if (ms > map[key].maxMs) map[key].maxMs = ms;
            if (e.status === "ERROR" || e.hasError) map[key].errors++;
        }
        return Object.entries(map)
            .map(([method, s]) => ({
                method,
                count: s.count,
                avgMs: Math.round(s.totalMs / s.count),
                maxMs: s.maxMs,
                errPct: Math.round((s.errors / s.count) * 100),
            }))
            .sort((a, b) => b.maxMs - a.maxMs)
            .slice(0, 12);
    }, [flatEvents]);

    // Always show the trend column — sparkline renders as dashes until backend history arrives
    const GRID = "1fr 28px 36px 44px 56px";

    return (
        <div>
            <SectionLabel right={`${rows.length} methods`}>Method Latency</SectionLabel>
            {/* column headers */}
            <div style={{
                display: "grid", gridTemplateColumns: GRID,
                gap: 4, padding: "0 4px 5px",
                borderBottom: `1px solid ${COLORS.border}`,
                fontSize: 9, fontWeight: 800, color: COLORS.muted,
                textTransform: "uppercase", letterSpacing: 0.8, fontFamily: MONO,
            }}>
                <span>Method</span>
                <span style={{ textAlign: "right" }}>calls</span>
                <span style={{ textAlign: "right" }}>err%</span>
                <span style={{ textAlign: "right" }}>max ms</span>
                <span style={{ textAlign: "right" }}>trend</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 3 }}>
                {rows.map((r, i) => {
                    const isHot   = r.maxMs > 500;
                    const hasErr  = r.errPct > 0;
                    const sparkColor = isHot ? COLORS.red : r.maxMs > 100 ? COLORS.orange : COLORS.green;
                    // Display name: strip package, keep ClassName.method()
                    const parts = r.method.replace(/\(.*\)/, "").split(".");
                    const shortName = parts.length >= 2
                        ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}()`
                        : parts[parts.length - 1] + "()";
                    // Exact key match — backend records same method string as TraceAspect emits
                    const series = latencyTimeseries ? latencyTimeseries[r.method] : null;
                    const sparkValues = series ? series.slice(-30) : null;

                    return (
                        <div key={r.method} style={{
                            display: "grid", gridTemplateColumns: GRID,
                            gap: 4, padding: "5px 4px", borderRadius: 6,
                            background: isHot ? `${COLORS.orange}07` : i % 2 === 0 ? `${COLORS.blue}03` : "transparent",
                            alignItems: "center",
                        }}>
                            {/* method name */}
                            <div style={{ minWidth: 0 }}>
                                <div style={{
                                    fontSize: 9.5, fontFamily: MONO, fontWeight: isHot ? 700 : 500,
                                    color: isHot ? COLORS.orange : COLORS.textSoft,
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }} title={r.method}>{shortName}</div>
                            </div>
                            <div style={{ fontSize: 9.5, color: COLORS.muted, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                                {r.count}
                            </div>
                            <div style={{
                                fontSize: 9.5, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums",
                                fontWeight: hasErr ? 800 : 400,
                                color: r.errPct > 10 ? COLORS.red : r.errPct > 0 ? COLORS.orange : COLORS.muted,
                            }}>
                                {r.errPct}%
                            </div>
                            <div style={{
                                fontSize: 9.5, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums",
                                fontWeight: isHot ? 800 : 400,
                                color: isHot ? COLORS.red : r.maxMs > 100 ? COLORS.orange : COLORS.muted,
                            }}>
                                {r.maxMs}
                            </div>
                            {/* sparkline column — always present, dashes when no history yet */}
                            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                                <Sparkline values={sparkValues} color={sparkColor} width={52} height={18} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

