package com.example.tracer.controller;

import com.example.tracer.tracing.CallTreeNode;
import com.example.tracer.tracing.InMemoryTraceCollector;
import com.example.tracer.tracing.MetricsDashboardReport;
import com.example.tracer.tracing.OpenTelemetryExportService;
import com.example.tracer.tracing.SourceCodeHelper;
import com.example.tracer.tracing.TraceAlertService;
import com.example.tracer.tracing.TraceAnalysisReport;
import com.example.tracer.tracing.TraceDiffReport;
import com.example.tracer.tracing.TraceExportService;
import com.example.tracer.tracing.TracePersistenceService;
import com.example.tracer.tracing.DistributedSpanMerger;
import com.example.tracer.tracing.TraceSearchService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/traces")
public class TraceReplayController {

    private final InMemoryTraceCollector collector;
    private final TracePersistenceService persistenceService;
    private final TraceExportService exportService;
    private final OpenTelemetryExportService otelExportService;
    private final TraceSearchService searchService;
    private final DistributedSpanMerger spanMerger;
    private final TraceAlertService alertService;

    public TraceReplayController(
            InMemoryTraceCollector collector,
            TracePersistenceService persistenceService,
            TraceExportService exportService,
            OpenTelemetryExportService otelExportService,
            TraceSearchService searchService,
            DistributedSpanMerger spanMerger,
            TraceAlertService alertService) {
        this.collector = collector;
        this.persistenceService = persistenceService;
        this.exportService = exportService;
        this.otelExportService = otelExportService;
        this.searchService = searchService;
        this.spanMerger = spanMerger;
        this.alertService = alertService;
    }

    @GetMapping
    public List<String> listTraces() {
        return collector.listRequestIds();
    }

    @GetMapping("/search")
    public List<TraceSearchService.TraceSearchResult> searchTraces(
            @RequestParam(required = false) String method,
            @RequestParam(required = false) Long minDurationMs,
            @RequestParam(required = false) Long maxDurationMs,
            @RequestParam(required = false) Boolean hasError,
            @RequestParam(required = false, defaultValue = "50") Integer limit) {
        return searchService.search(new TraceSearchService.TraceSearchCriteria(
                method, minDurationMs, maxDurationMs, hasError, limit));
    }

    @GetMapping("/history")
    public List<TracePersistenceService.PersistedTraceSummary> listHistory() throws IOException {
        return persistenceService.listPersistedTraces();
    }

    @GetMapping("/alerts")
    public List<TraceAlertService.TraceAlert> getAlerts(
            @RequestParam(required = false) String requestId) {
        if (requestId != null && !requestId.isBlank()) {
            return alertService.evaluate(requestId);
        }
        return alertService.evaluateAll();
    }

    @GetMapping("/metrics")
    public MetricsDashboardReport getMetrics() {
        return collector.getMetricsDashboard();
    }

    @GetMapping("/metrics/dashboard")
    public MetricsDashboardReport getMetricsDashboard() {
        return collector.getMetricsDashboard();
    }

    @GetMapping("/{requestId}")
    public String getTrace(@PathVariable String requestId) {
        CallTreeNode root = collector.getTrace(requestId);
        if (root == null) {
            return "No trace found for requestId=" + requestId;
        }

        StringBuilder sb = new StringBuilder();
        printTree(root, 0, sb);
        return sb.toString();
    }

    @GetMapping("/{requestId}/json")
    public CallTreeNode getTraceJson(@PathVariable String requestId) {
        return collector.getTrace(requestId);
    }

    @GetMapping("/{requestId}/analysis")
    public TraceAnalysisReport getTraceAnalysis(@PathVariable String requestId) {
        TraceAnalysisReport report = collector.analyzeTrace(requestId);
        if (report == null) {
            return new TraceAnalysisReport(
                    requestId, 0, 0, 0, 0, 0, 0, 0,
                    List.of("No trace found"));
        }
        return report;
    }

    @GetMapping("/diff")
    public TraceDiffReport getTraceDiff(
            @RequestParam String baseRequestId,
            @RequestParam String compareRequestId) {
        return collector.diffTraces(baseRequestId, compareRequestId);
    }

    @GetMapping("/shared/{shareId}")
    public CallTreeNode getSharedTrace(@PathVariable String shareId) throws IOException {
        CallTreeNode tree = persistenceService.loadByShareId(shareId);
        if (tree == null) {
            throw new TraceNotFoundException("No shared trace for shareId=" + shareId);
        }
        return tree;
    }

    @PostMapping("/{requestId}/persist")
    public TracePersistenceService.PersistedTraceReference persistTrace(@PathVariable String requestId)
            throws IOException {
        TracePersistenceService.PersistedTraceReference ref = persistenceService.persist(requestId);
        if (ref == null) {
            throw new TraceNotFoundException("No trace found for requestId=" + requestId);
        }
        return ref;
    }

    @GetMapping("/{requestId}/export/json")
    public CallTreeNode exportJson(@PathVariable String requestId) {
        CallTreeNode root = collector.getTrace(requestId);
        if (root == null) {
            throw new TraceNotFoundException("No trace found for requestId=" + requestId);
        }
        return root;
    }

    @GetMapping(value = "/{requestId}/export/svg", produces = "image/svg+xml")
    public ResponseEntity<String> exportSvg(@PathVariable String requestId) {
        CallTreeNode root = collector.getTrace(requestId);
        if (root == null) {
            throw new TraceNotFoundException("No trace found for requestId=" + requestId);
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"trace-" + requestId + ".svg\"")
                .body(exportService.toSvg(root, requestId));
    }

    @GetMapping(value = "/{requestId}/export/otel", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> exportOpenTelemetry(@PathVariable String requestId) {
        CallTreeNode root = collector.getTrace(requestId);
        if (root == null) {
            throw new TraceNotFoundException("No trace found for requestId=" + requestId);
        }
        return otelExportService.toOpenTelemetryJson(root, requestId);
    }

    @PostMapping("/{requestId}/spans")
    public Map<String, Object> mergeRemoteSpans(
            @PathVariable String requestId,
            @RequestBody List<DistributedSpanMerger.RemoteSpanPayload> spans) {
        int merged = collector.mergeRemoteSpans(requestId, spans, spanMerger);
        return Map.of("requestId", requestId, "mergedCount", merged);
    }

    @GetMapping(value = "/{requestId}/export/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportPdf(@PathVariable String requestId) {
        CallTreeNode root = collector.getTrace(requestId);
        if (root == null) {
            throw new TraceNotFoundException("No trace found for requestId=" + requestId);
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"trace-" + requestId + ".pdf\"")
                .body(exportService.toPdfBytes(root, requestId));
    }

    @GetMapping("/source")
    public SourceCodeHelper.SourceSnippet getSourceCodeSnippet(
            @RequestParam String className,
            @RequestParam int lineNumber,
            @RequestParam(defaultValue = "7") int contextLines) {
        return SourceCodeHelper.getSourceSnippet(className, lineNumber, contextLines);
    }

    @GetMapping("/{requestId}/source")
    public SourceCodeHelper.SourceSnippet getSourceCode(
            @PathVariable String requestId,
            @RequestParam String className,
            @RequestParam int lineNumber,
            @RequestParam(defaultValue = "5") int contextLines) {
        return SourceCodeHelper.getSourceSnippet(className, lineNumber, contextLines);
    }

    @PostMapping("/{requestId}/replay")
    public ReplayResponse replayRequest(
            @PathVariable String requestId,
            @RequestBody(required = false) Map<String, Object> paramOverrides) {
        CallTreeNode root = collector.getTrace(requestId);
        if (root == null) {
            return new ReplayResponse(
                false,
                "No trace found for requestId=" + requestId,
                null
            );
        }

        ReplayResponse response = new ReplayResponse(
            true,
            "Trace structure captured. Manual replay required—see instructions below.",
            buildReplayInstructions(root, paramOverrides)
        );

        return response;
    }

    private String buildReplayInstructions(CallTreeNode root, Map<String, Object> overrides) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== TRACE REPLAY INSTRUCTIONS ===\n\n");
        sb.append("1. CAPTURED TRACE:\n");
        printTree(root, 0, sb);

        if (overrides != null && !overrides.isEmpty()) {
            sb.append("\n2. PARAMETER OVERRIDES:\n");
            overrides.forEach((k, v) -> sb.append("   ").append(k).append(" = ").append(v).append("\n"));
        }

        sb.append("\n3. TO REPLAY SAFELY:\n");
        sb.append("   - Replay only in test/dev environments\n");
        sb.append("   - Review trace for PII before sharing\n");
        sb.append("   - Call the original endpoint manually with same params\n");
        sb.append("   - Use /traces/{newRequestId}/json to compare new vs old trace\n");

        return sb.toString();
    }

    public static class ReplayResponse {
        public boolean success;
        public String message;
        public String instructions;

        public ReplayResponse(boolean success, String message, String instructions) {
            this.success = success;
            this.message = message;
            this.instructions = instructions;
        }

        public boolean isSuccess() { return success; }
        public String getMessage() { return message; }
        public String getInstructions() { return instructions; }
    }

    @ResponseStatus(org.springframework.http.HttpStatus.NOT_FOUND)
    public static class TraceNotFoundException extends RuntimeException {
        public TraceNotFoundException(String message) {
            super(message);
        }
    }

    private void printTree(CallTreeNode node, int depth, StringBuilder sb) {
        String indent = "  ".repeat(depth);
        sb.append(indent)
          .append(node.getMethodName())
          .append(" (").append(node.getExecutionTime()).append("ms)")
          .append("\n");

        for (CallTreeNode child : node.getChildren()) {
            printTree(child, depth + 1, sb);
        }
    }
}
