package com.example.tracer.config;

import com.example.tracer.tracing.AsyncContextPropagator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Configuration for async method execution with trace context propagation.
 * Enables @Async and configures the executor to propagate trace contexts
 * across thread boundaries.
 */
@Configuration
@EnableAsync
public class AsyncTraceConfig {

    @Bean(name = "traceAsyncExecutor")
    public Executor traceAsyncExecutor(AsyncContextPropagator contextPropagator) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setTaskDecorator(contextPropagator);
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("async-trace-");
        executor.initialize();
        return executor;
    }
}
