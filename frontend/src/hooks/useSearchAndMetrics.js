import { useEffect, useState } from "react";
import { fetchMetricsDashboard, searchTraces, fetchTraceHistory, fetchAlerts, fetchLatencyTimeseries } from "../services/traceApi";

/**
 * Handles all server-side search, metrics, history, alert polling, and latency timeseries.
 */
export function useSearchAndMetrics(eventsByRequest, selectedRequestId, searchCriteria) {
    const { method, minMs, errorsOnly } = searchCriteria;

    const [metricsReport, setMetricsReport] = useState(null);
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [metricsError, setMetricsError] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchError, setSearchError] = useState(null);
    const [historyTraces, setHistoryTraces] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [latencyTimeseries, setLatencyTimeseries] = useState({});

    // Metrics — poll every 15 s whenever traces change
    useEffect(() => {
        let cancelled = false;
        const load = () => {
            setMetricsLoading(true);
            fetchMetricsDashboard()
                .then((report) => {
                    if (!cancelled) { setMetricsReport(report); setMetricsError(null); }
                })
                .catch((err) => { if (!cancelled) setMetricsError(err.message); })
                .finally(() => { if (!cancelled) setMetricsLoading(false); });
        };
        load();
        const interval = setInterval(load, 15000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [eventsByRequest]);

    // Trace search — re-run whenever criteria or data changes.
    // Only show errors when the user has actually typed search criteria;
    // background/empty-criteria fetches fail silently.
    const hasCriteria = !!(method || minMs || errorsOnly);
    useEffect(() => {
        let cancelled = false;
        const run = () => {
            searchTraces({
                method: method || undefined,
                minDurationMs: minMs ? Number(minMs) : undefined,
                hasError: errorsOnly ? true : undefined,
            })
                .then((results) => {
                    if (!cancelled) { setSearchResults(results); setSearchError(null); }
                })
                .catch((err) => {
                    if (!cancelled) {
                        setSearchResults([]);
                        // Only surface errors when the user actively set criteria
                        setSearchError(hasCriteria ? err.message : null);
                    }
                });
        };
        run();
        const interval = setInterval(run, 10000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [eventsByRequest, method, minMs, errorsOnly, hasCriteria]);

    // History — re-fetch whenever traces change
    useEffect(() => {
        let cancelled = false;
        fetchTraceHistory()
            .then((history) => { if (!cancelled) setHistoryTraces(history); })
            .catch(() => { if (!cancelled) setHistoryTraces([]); });
        return () => { cancelled = true; };
    }, [eventsByRequest]);

    // Alerts — poll every 15 s
    useEffect(() => {
        let cancelled = false;
        const load = () => {
            fetchAlerts(selectedRequestId || undefined)
                .then((data) => { if (!cancelled) setAlerts(data); })
                .catch(() => {});
        };
        load();
        const interval = setInterval(load, 15000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [selectedRequestId, eventsByRequest]);

    // Latency timeseries — poll every 20 s
    useEffect(() => {
        let cancelled = false;
        const load = () => {
            fetchLatencyTimeseries()
                .then((data) => { if (!cancelled) setLatencyTimeseries(data || {}); })
                .catch(() => {});
        };
        load();
        const interval = setInterval(load, 20000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [eventsByRequest]);

    return { metricsReport, metricsLoading, metricsError, searchResults, searchError, historyTraces, alerts, latencyTimeseries };
}
