package com.example.tracer.tracing;

import java.util.ArrayDeque;
import java.util.Deque;

/*
A per-thread execution stack that mirrors the real method call stack. 
It uses ThreadLocal to maintain a separate stack for each thread, 
ensuring thread safety in concurrent environments.
*/

public class TraceStack {

    private static final ThreadLocal<Deque<TraceContext>> callStack =
            ThreadLocal.withInitial(ArrayDeque::new);

    public static void push(TraceContext context) {
        callStack.get().push(context);
    }

    public static TraceContext pop() {
        return callStack.get().pop();
    }

    public static TraceContext peek() {
        return callStack.get().peek();
    }

    public static int depth() {
        return callStack.get().size();
    }

    public static void clear() {
        callStack.remove();
    }
}
