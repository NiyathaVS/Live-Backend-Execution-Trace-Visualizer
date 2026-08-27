package com.example.tracer.tracing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Merges spans received from remote services into an existing trace tree
 * using stable spanId / parentSpanId linkage.
 */
@Component
public class DistributedSpanMerger {

    private final String localServiceName;

    public DistributedSpanMerger(
            @Value("${spring.application.name:instrumented-app}") String localServiceName) {
        this.localServiceName = localServiceName;
    }

    public int mergeRemoteSpans(CallTreeNode root, List<RemoteSpanPayload> remoteSpans) {
        if (root == null || remoteSpans == null || remoteSpans.isEmpty()) {
            return 0;
        }

        int merged = 0;
        for (RemoteSpanPayload remote : remoteSpans) {
            CallTreeNode node = toNode(remote);
            CallTreeNode parent = findBySpanId(root, remote.parentSpanId());
            if (parent != null) {
                if (!hasChildWithSpanId(parent, node.getSpanId())) {
                    parent.addChild(node);
                    merged++;
                }
            } else {
                if (!hasChildWithSpanId(root, node.getSpanId())) {
                    root.addChild(node);
                    merged++;
                }
            }
        }
        return merged;
    }

    private CallTreeNode toNode(RemoteSpanPayload remote) {
        String label = remote.serviceName() + "::" + remote.methodName();
        CallTreeNode node = new CallTreeNode(label, remote.startTimeMs());
        node.setSpanId(remote.spanId());
        node.setParentSpanId(remote.parentSpanId());
        node.setExecutionTime(remote.durationMs());
        node.setHasError(remote.hasError());
        node.setErrorMessage(remote.errorMessage());
        if (remote.attributes() != null) {
            node.setParams(remote.attributes());
        }
        return node;
    }

    private CallTreeNode findBySpanId(CallTreeNode current, String spanId) {
        if (spanId == null) {
            return null;
        }
        if (spanId.equals(current.getSpanId())) {
            return current;
        }
        for (CallTreeNode child : current.getChildren()) {
            CallTreeNode match = findBySpanId(child, spanId);
            if (match != null) {
                return match;
            }
        }
        return null;
    }

    private boolean hasChildWithSpanId(CallTreeNode parent, String spanId) {
        if (spanId == null) {
            return false;
        }
        for (CallTreeNode child : parent.getChildren()) {
            if (spanId.equals(child.getSpanId())) {
                return true;
            }
        }
        return false;
    }

    public record RemoteSpanPayload(
            String spanId,
            String parentSpanId,
            String serviceName,
            String methodName,
            long startTimeMs,
            long durationMs,
            boolean hasError,
            String errorMessage,
            Map<String, Object> attributes) {
    }
}
