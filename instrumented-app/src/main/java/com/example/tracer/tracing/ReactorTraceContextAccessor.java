package com.example.tracer.tracing;

import com.example.tracer.config.ReactorTraceContextConfig;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Utility for wrapping reactive chains with trace context propagation.
 */
@Component
public class ReactorTraceContextAccessor {

    public static <T> Mono<T> withTraceContext(Mono<T> mono) {
        return ReactorTraceContextConfig.wrap(mono);
    }

    public static <T> Flux<T> withTraceContext(Flux<T> flux) {
        return ReactorTraceContextConfig.wrap(flux);
    }
}
