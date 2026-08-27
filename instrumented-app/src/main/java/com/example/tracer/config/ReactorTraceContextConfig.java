package com.example.tracer.config;

import com.example.tracer.tracing.TraceContext;
import com.example.tracer.tracing.TraceStack;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.util.context.Context;
import reactor.util.context.ContextView;

import java.util.Map;

/**
 * Propagates trace context across Reactor operators.
 * Wrap reactive chains with {@link #wrap(Mono)} or {@link #wrap(Flux)} so
 * parentSpanId and MDC survive thread hops in WebFlux / reactive code.
 */
@Configuration
public class ReactorTraceContextConfig {

    private static final Logger log = LoggerFactory.getLogger(ReactorTraceContextConfig.class);
    public static final String CTX_PARENT_SPAN = "trace.parentSpanId";
    public static final String CTX_MDC = "trace.mdc";

    public ReactorTraceContextConfig() {
        log.info("Reactor trace context utilities available (wrap Mono/Flux with contextWrite)");
    }

    public static Context captureContext() {
        TraceContext parent = TraceStack.peek();
        Map<String, String> mdc = MDC.getCopyOfContextMap();
        Context ctx = Context.empty();
        if (parent != null && parent.getSpanId() != null) {
            ctx = ctx.put(CTX_PARENT_SPAN, parent.getSpanId());
        }
        if (mdc != null) {
            ctx = ctx.put(CTX_MDC, mdc);
        }
        return ctx;
    }

    public static <T> Mono<T> wrap(Mono<T> mono) {
        return mono.contextWrite(captureContext())
                .transformDeferredContextual((m, ctx) -> m.doOnEach(signal -> restoreFromContext(ctx))
                        .doFinally(s -> clearThreadLocals()));
    }

    public static <T> Flux<T> wrap(Flux<T> flux) {
        return flux.contextWrite(captureContext())
                .transformDeferredContextual((f, ctx) -> f.doOnEach(signal -> restoreFromContext(ctx))
                        .doFinally(s -> clearThreadLocals()));
    }

    public static void restoreFromContext(ContextView ctx) {
        if (ctx.hasKey(CTX_MDC)) {
            @SuppressWarnings("unchecked")
            Map<String, String> mdc = ctx.get(CTX_MDC);
            MDC.setContextMap(mdc);
        }
        if (ctx.hasKey(CTX_PARENT_SPAN)) {
            String parentSpanId = ctx.get(CTX_PARENT_SPAN);
            if (TraceStack.peek() == null) {
                TraceStack.push(new TraceContext("REACTOR_BOUNDARY", System.currentTimeMillis(), parentSpanId));
            }
        }
    }

    public static void clearThreadLocals() {
        TraceStack.clear();
        MDC.clear();
    }
}
