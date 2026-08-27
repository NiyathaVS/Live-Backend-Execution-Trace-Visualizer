package com.example.tracer.tracing;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.example.tracer.tracing.TraceStack;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

@Component
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_KEY = "requestId";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String requestId = resolveRequestId(request);
        Optional<DistributedTraceContext.InboundTrace> inbound =
                DistributedTraceContext.fromRequest(request);

        try {
            MDC.put(REQUEST_ID_KEY, requestId);
            response.setHeader(DistributedTraceContext.HEADER_TRACE_ID, requestId);

            inbound.ifPresent(trace -> {
                if (trace.parentSpanId() != null) {
                    TraceStack.push(new TraceContext(
                            "INBOUND_HTTP",
                            System.currentTimeMillis(),
                            trace.parentSpanId()
                    ));
                }
            });

            filterChain.doFilter(request, response);

        } finally {
            inbound.ifPresent(trace -> {
                if (trace.parentSpanId() != null) {
                    TraceStack.pop();
                }
            });
            TraceStack.clear();
            MDC.remove(REQUEST_ID_KEY);
        }
    }

    private String resolveRequestId(HttpServletRequest request) {
        return DistributedTraceContext.fromRequest(request)
                .map(t -> DistributedTraceContext.normalizeTraceId(t.traceId()))
                .orElseGet(() -> UUID.randomUUID().toString());
    }
}
