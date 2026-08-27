package com.example.tracer.tracing;

import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * TaskDecorator for Spring's @Async to propagate trace context
 * across thread boundaries. This ensures that async method calls
 * maintain parent-child relationships in the call tree.
 */
@Component
public class AsyncContextPropagator implements TaskDecorator {

    @Override
    public Runnable decorate(Runnable runnable) {
        TraceContext currentContext = TraceStack.peek();
        String parentSpanId = currentContext != null ? currentContext.getSpanId() : null;
        Map<String, String> mdcCopy = MDC.getCopyOfContextMap();

        return () -> {
            if (mdcCopy != null) {
                MDC.setContextMap(mdcCopy);
            }
            if (parentSpanId != null) {
                TraceStack.push(new TraceContext(
                    "ASYNC_TASK",
                    System.currentTimeMillis(),
                    parentSpanId
                ));
            }

            try {
                runnable.run();
            } finally {
                if (parentSpanId != null) {
                    TraceStack.pop();
                }
                MDC.clear();
            }
        };
    }
}
