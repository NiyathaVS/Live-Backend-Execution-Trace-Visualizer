const API_BASE =
    import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8080";

export async function fetchTraceDiff(baseRequestId, compareRequestId) {
    const url = `${API_BASE}/traces/diff?baseRequestId=${encodeURIComponent(baseRequestId)}&compareRequestId=${encodeURIComponent(compareRequestId)}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Diff fetch failed: ${res.status}`);
    }
    const data = await res.json();
    return {
        addedMethods: data.addedMethods || [],
        removedMethods: data.removedMethods || [],
        timingDeltas: (data.timingDeltas || []).map((d) => ({
            method: d.method,
            deltaMs: d.deltaMs ?? Math.round((d.compareAvgMs ?? 0) - (d.baseAvgMs ?? 0))
        }))
    };
}

export async function fetchTraceAnalysis(requestId) {
    const res = await fetch(`${API_BASE}/traces/${encodeURIComponent(requestId)}/analysis`);
    if (!res.ok) {
        throw new Error(`Analysis fetch failed: ${res.status}`);
    }
    return res.json();
}

export async function fetchMetricsDashboard() {
    const res = await fetch(`${API_BASE}/traces/metrics/dashboard`);
    if (!res.ok) {
        throw new Error(`Metrics fetch failed: ${res.status}`);
    }
    return res.json();
}

export async function persistTrace(requestId) {
    const res = await fetch(`${API_BASE}/traces/${encodeURIComponent(requestId)}/persist`, {
        method: "POST"
    });
    if (!res.ok) {
        throw new Error(`Persist failed: ${res.status}`);
    }
    return res.json();
}

export function exportUrl(requestId, format) {
    return `${API_BASE}/traces/${encodeURIComponent(requestId)}/export/${format}`;
}

export async function searchTraces({ method, minDurationMs, maxDurationMs, hasError, limit = 50 }) {
    const params = new URLSearchParams();
    if (method) params.set("method", method);
    if (minDurationMs != null) params.set("minDurationMs", String(minDurationMs));
    if (maxDurationMs != null) params.set("maxDurationMs", String(maxDurationMs));
    if (hasError != null) params.set("hasError", String(hasError));
    params.set("limit", String(limit));
    const res = await fetch(`${API_BASE}/traces/search?${params}`);
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json();
}

export async function fetchTraceHistory() {
    const res = await fetch(`${API_BASE}/traces/history`);
    if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
    return res.json();
}

export async function fetchAlerts(requestId) {
    const url = requestId
        ? `${API_BASE}/traces/alerts?requestId=${encodeURIComponent(requestId)}`
        : `${API_BASE}/traces/alerts`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Alerts fetch failed: ${res.status}`);
    return res.json();
}

export function otelExportUrl(requestId) {
    return `${API_BASE}/traces/${encodeURIComponent(requestId)}/export/otel`;
}
