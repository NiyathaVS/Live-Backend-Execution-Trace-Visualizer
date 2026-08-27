package com.example.tracer.tracing;

import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.slf4j.MDC;
import java.io.IOException;

/**
 * HTTP interceptor for propagating distributed trace context.
 * Adds W3C Trace Context headers (traceparent) to outbound HTTP requests
 * and optional X-Trace-Id header for backward compatibility.
 * 
 * Usage: Register with RestTemplate or WebClient.
 */
public class DistributedTraceInterceptor implements ClientHttpRequestInterceptor {

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body,
                                       ClientHttpRequestExecution execution) throws IOException {
        // Get current trace context
        TraceContext context = TraceStack.peek();
        String requestId = MDC.get(RequestIdFilter.REQUEST_ID_KEY);
        
        // Add W3C Trace Context header (version 00, format: version-trace-parent-span-flags)
        if (context != null) {
            String traceparent = formatTraceparent(requestId, context.getSpanId());
            request.getHeaders().set("traceparent", traceparent);
        }
        
        // Add custom X-Trace-Id header for backward compatibility
        if (requestId != null) {
            request.getHeaders().set("X-Trace-Id", requestId);
        }
        
        return execution.execute(request, body);
    }
    
    /**
     * Format W3C Trace Context traceparent header.
     * Format: version(2)-trace-id(32)-parent-id(16)-trace-flags(2)
     * Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
     */
    private String formatTraceparent(String traceId, String spanId) {
        String version = "00";
        String traceIdPart = traceId != null ? traceId.replace("-", "").substring(0, 32) : "0".repeat(32);
        String parentIdPart = spanId != null ? spanId.replace("-", "").substring(0, 16) : "0".repeat(16);
        String flags = "01"; // Trace recorded
        
        return String.format("%s-%s-%s-%s", version, traceIdPart, parentIdPart, flags);
    }
}
