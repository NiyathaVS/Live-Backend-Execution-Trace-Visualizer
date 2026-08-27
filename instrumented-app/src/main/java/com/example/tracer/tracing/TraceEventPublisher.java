package com.example.tracer.tracing;

public interface TraceEventPublisher {
    void publish(TraceEvent event);
}
