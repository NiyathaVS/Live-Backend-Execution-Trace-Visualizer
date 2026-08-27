package com.example.tracer.config;

import com.example.tracer.tracing.ConsoleTraceEventPublisher;
import com.example.tracer.tracing.InMemoryTraceCollector;
import com.example.tracer.tracing.TraceEventPublisher;
import com.example.tracer.tracing.TraceWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TraceConfiguration {

    @Value("${trace.max-traces:1000}")
    private int maxTraces;
    
    @Value("${trace.ttl-seconds:3600}")
    private long ttlSeconds;
    
    @Value("${trace.sampling:all}")
    private String sampling;

    @Bean
    public TraceEventPublisher traceEventPublisher() {
        // Currently publishing JSON to console
        return new ConsoleTraceEventPublisher();
    }

    @Bean
    public InMemoryTraceCollector inMemoryTraceCollector() {
        return new InMemoryTraceCollector(maxTraces, ttlSeconds, sampling);
    }

    @Bean
    public TraceWebSocketHandler traceWebSocketHandler() {
        // Singleton handler for all WebSocket connections
        return new TraceWebSocketHandler();
    }

}
