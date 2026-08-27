package com.example.tracer.tracing;

import org.slf4j.MDC;

import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.function.Supplier;

/**
 * Propagates trace stack + MDC across CompletableFuture and executor boundaries.
 */
public final class TraceContextPropagator {

    private TraceContextPropagator() {
    }

    public static Runnable wrap(Runnable task) {
        TraceContext parent = TraceStack.peek();
        String parentSpanId = parent != null ? parent.getSpanId() : null;
        Map<String, String> mdcCopy = MDC.getCopyOfContextMap();

        return () -> runWithContext(() -> task.run(), parentSpanId, mdcCopy);
    }

    public static <T> Callable<T> wrap(Callable<T> task) {
        TraceContext parent = TraceStack.peek();
        String parentSpanId = parent != null ? parent.getSpanId() : null;
        Map<String, String> mdcCopy = MDC.getCopyOfContextMap();

        return () -> {
            final T[] holder = (T[]) new Object[1];
            runWithContext(() -> holder[0] = task.call(), parentSpanId, mdcCopy);
            return holder[0];
        };
    }

    public static <T> Supplier<T> wrap(Supplier<T> supplier) {
        TraceContext parent = TraceStack.peek();
        String parentSpanId = parent != null ? parent.getSpanId() : null;
        Map<String, String> mdcCopy = MDC.getCopyOfContextMap();

        return () -> {
            final T[] holder = (T[]) new Object[1];
            runWithContext(() -> holder[0] = supplier.get(), parentSpanId, mdcCopy);
            return holder[0];
        };
    }

    public static <T> CompletableFuture<T> supplyAsync(Supplier<T> supplier, Executor executor) {
        return CompletableFuture.supplyAsync(wrap(supplier), executor);
    }

    public static CompletableFuture<Void> runAsync(Runnable runnable, Executor executor) {
        return CompletableFuture.runAsync(wrap(runnable), executor);
    }

    private static void runWithContext(RunnableWithException task,
                                       String parentSpanId,
                                       Map<String, String> mdcCopy) {
        if (mdcCopy != null) {
            MDC.setContextMap(mdcCopy);
        }
        if (parentSpanId != null) {
            TraceStack.push(new TraceContext("ASYNC_BOUNDARY", System.currentTimeMillis(), parentSpanId));
        }
        try {
            task.run();
        } catch (Exception e) {
            throw new RuntimeException(e);
        } finally {
            if (parentSpanId != null) {
                TraceStack.pop();
            }
            MDC.clear();
        }
    }

    @FunctionalInterface
    private interface RunnableWithException {
        void run() throws Exception;
    }
}
