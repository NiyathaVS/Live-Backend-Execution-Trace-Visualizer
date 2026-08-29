package com.example.tracer.tracing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;

@Service
public class TracePersistenceService {

    private final InMemoryTraceCollector collector;
    private final Path storageDir;
    private final long retentionMillis;
    private final Map<String, String> shareIdToRequestId = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public TracePersistenceService(
            InMemoryTraceCollector collector,
            @Value("${trace.persistence.dir:./trace-data}") String storageDir,
            @Value("${trace.persistence.retention-days:7}") int retentionDays) {
        this.collector = collector;
        this.storageDir = Path.of(storageDir);
        this.retentionMillis = retentionDays * 24L * 60 * 60 * 1000;
        this.objectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        initStorage();
    }

    private void initStorage() {
        try {
            Files.createDirectories(storageDir);
            Files.createDirectories(storageDir.resolve("shares"));
            purgeExpired();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to initialize trace persistence at " + storageDir, e);
        }
    }

    public PersistedTraceReference persist(String requestId) throws IOException {
        CallTreeNode root = collector.getTrace(requestId);
        if (root == null) {
            return null;
        }

        String shareId = UUID.randomUUID().toString();
        PersistedTracePayload payload = new PersistedTracePayload(
                requestId,
                shareId,
                Instant.now().toString(),
                root,
                collector.analyzeTrace(requestId)
        );

        Path traceFile = storageDir.resolve(requestId + ".json");
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(traceFile.toFile(), payload);

        Path shareFile = storageDir.resolve("shares").resolve(shareId + ".txt");
        Files.writeString(shareFile, requestId);

        shareIdToRequestId.put(shareId, requestId);
        return new PersistedTraceReference(requestId, shareId, "/traces/shared/" + shareId);
    }

    public CallTreeNode loadByShareId(String shareId) throws IOException {
        String requestId = shareIdToRequestId.get(shareId);
        if (requestId == null) {
            Path shareFile = storageDir.resolve("shares").resolve(shareId + ".txt");
            if (!Files.exists(shareFile)) {
                return null;
            }
            requestId = Files.readString(shareFile).trim();
            shareIdToRequestId.put(shareId, requestId);
        }
        return loadByRequestId(requestId);
    }

    public CallTreeNode loadByRequestId(String requestId) throws IOException {
        Path traceFile = storageDir.resolve(requestId + ".json");
        if (!Files.exists(traceFile)) {
            return collector.getTrace(requestId);
        }
        PersistedTracePayload payload = objectMapper.readValue(traceFile.toFile(), PersistedTracePayload.class);
        return payload.tree();
    }

    public void purgeExpired() throws IOException {
        long cutoffMs = System.currentTimeMillis() - retentionMillis;
        try (Stream<Path> files = Files.list(storageDir)) {
            files.filter(p -> p.toString().endsWith(".json"))
                    .forEach(p -> {
                        try {
                            // Use the persistedAt timestamp recorded in the payload
                            // rather than the file's last-modified time, which can be
                            // reset by backup tools or filesystem operations.
                            PersistedTracePayload payload =
                                    objectMapper.readValue(p.toFile(), PersistedTracePayload.class);
                            long persistedMs = Instant.parse(payload.persistedAt()).toEpochMilli();
                            if (persistedMs < cutoffMs) {
                                Files.deleteIfExists(p);
                            }
                        } catch (IOException ignored) {
                        }
                    });
        }
    }

    public record PersistedTraceReference(String requestId, String shareId, String sharePath) {
    }

    public record PersistedTracePayload(
            String requestId,
            String shareId,
            String persistedAt,
            CallTreeNode tree,
            TraceAnalysisReport analysis) {
    }

    public List<PersistedTraceSummary> listPersistedTraces() throws IOException {
        List<PersistedTraceSummary> summaries = new ArrayList<>();
        try (Stream<Path> files = Files.list(storageDir)) {
            files.filter(p -> p.toString().endsWith(".json"))
                    .forEach(p -> {
                        try {
                            PersistedTracePayload payload = objectMapper.readValue(
                                    p.toFile(), PersistedTracePayload.class);
                            long totalMs = payload.tree().getChildren().stream()
                                    .mapToLong(CallTreeNode::getExecutionTime).sum();
                            summaries.add(new PersistedTraceSummary(
                                    payload.requestId(),
                                    payload.shareId(),
                                    payload.persistedAt(),
                                    totalMs,
                                    countNodes(payload.tree()),
                                    hasErrors(payload.tree())
                            ));
                        } catch (IOException ignored) {
                        }
                    });
        }
        summaries.sort(Comparator.comparing(PersistedTraceSummary::persistedAt).reversed());
        return summaries;
    }

    private int countNodes(CallTreeNode node) {
        int count = "ROOT".equals(node.getMethodName()) ? 0 : 1;
        for (CallTreeNode child : node.getChildren()) {
            count += countNodes(child);
        }
        return count;
    }

    private boolean hasErrors(CallTreeNode node) {
        if (node.hasError()) return true;
        for (CallTreeNode child : node.getChildren()) {
            if (hasErrors(child)) return true;
        }
        return false;
    }

    public record PersistedTraceSummary(
            String requestId,
            String shareId,
            String persistedAt,
            long totalDurationMs,
            int nodeCount,
            boolean hasError) {
    }
}
