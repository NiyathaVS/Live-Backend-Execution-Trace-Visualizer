import React from "react";

export default function MetricsDashboard({ report, loading, error }) {
    if (loading) {
        return (
            <div style={{ fontSize: 12, color: "#9ca3af", padding: 8 }}>
                Loading aggregate metrics…
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ fontSize: 12, color: "#fca5a5", padding: 8 }}>
                {error}
            </div>
        );
    }

    if (!report) {
        return null;
    }

    const metrics = report.methodMetrics || [];
    const anomalies = report.anomalies || [];

    return (
        <div
            style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                border: "1px solid rgba(55,65,81,0.8)",
                background: "rgba(2,6,23,0.85)"
            }}
        >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                Statistical dashboard ({report.traceCount ?? 0} traces)
            </div>

            {anomalies.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 4 }}>
                        Anomalies
                    </div>
                    {anomalies.map((a, i) => (
                        <div key={i} style={{ fontSize: 11, color: "#fde68a" }}>
                            {a}
                        </div>
                    ))}
                </div>
            )}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "2fr repeat(6, 1fr)",
                    gap: 4,
                    fontSize: 10,
                    color: "#9ca3af",
                    marginBottom: 4
                }}
            >
                <span>Method</span>
                <span>Count</span>
                <span>Avg</span>
                <span>p50</span>
                <span>p95</span>
                <span>p99</span>
                <span>Err%</span>
            </div>

            {metrics.length === 0 && (
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                    No aggregate data yet. Run more instrumented requests.
                </div>
            )}

            {metrics.slice(0, 12).map((m) => (
                <div
                    key={m.method}
                    style={{
                        display: "grid",
                        gridTemplateColumns: "2fr repeat(6, 1fr)",
                        gap: 4,
                        fontSize: 10,
                        color: "#e5e7eb",
                        padding: "2px 0",
                        borderTop: "1px solid rgba(55,65,81,0.3)"
                    }}
                >
                    <span
                        style={{
                            fontFamily: "ui-monospace, SFMono-Regular",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                        }}
                        title={m.method}
                    >
                        {m.method.split(".").pop()}
                    </span>
                    <span>{m.count}</span>
                    <span>{Math.round(m.avgMs)}ms</span>
                    <span>{m.p50Ms}ms</span>
                    <span>{m.p95Ms}ms</span>
                    <span>{m.p99Ms}ms</span>
                    <span style={{ color: m.errorRate > 0.1 ? "#fca5a5" : "#86efac" }}>
                        {Math.round((m.errorRate || 0) * 100)}%
                    </span>
                </div>
            ))}
        </div>
    );
}
