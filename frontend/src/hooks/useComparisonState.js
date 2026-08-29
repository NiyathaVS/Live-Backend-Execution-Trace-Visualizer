import { useEffect, useState } from "react";
import { fetchTraceDiff, fetchTraceAnalysis } from "../services/traceApi";

/**
 * Manages the comparison/diff state between two selected requests.
 */
export function useComparisonState(selectedRequestId) {
    const [compareRequestId, setCompareRequestId] = useState(null);
    const [diffReport, setDiffReport] = useState(null);
    const [diffLoading, setDiffLoading] = useState(false);
    const [analysisReport, setAnalysisReport] = useState(null);

    // Fetch diff whenever both IDs are set
    useEffect(() => {
        if (!selectedRequestId || !compareRequestId) {
            setDiffReport(null);
            return;
        }
        let cancelled = false;
        setDiffLoading(true);
        fetchTraceDiff(selectedRequestId, compareRequestId)
            .then((report) => { if (!cancelled) setDiffReport(report); })
            .catch(() => { if (!cancelled) setDiffReport(null); })
            .finally(() => { if (!cancelled) setDiffLoading(false); });
        return () => { cancelled = true; };
    }, [selectedRequestId, compareRequestId]);

    // Fetch analysis whenever selected request changes
    useEffect(() => {
        if (!selectedRequestId) {
            setAnalysisReport(null);
            return;
        }
        let cancelled = false;
        fetchTraceAnalysis(selectedRequestId)
            .then((report) => { if (!cancelled) setAnalysisReport(report); })
            .catch(() => { if (!cancelled) setAnalysisReport(null); });
        return () => { cancelled = true; };
    }, [selectedRequestId]);

    const reset = () => {
        setCompareRequestId(null);
        setDiffReport(null);
        setAnalysisReport(null);
    };

    return {
        compareRequestId,
        setCompareRequestId,
        diffReport,
        diffLoading,
        analysisReport,
        reset,
    };
}
