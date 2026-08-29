import { useEffect, useRef, useState } from "react";
import { connectWebSocket, disconnectWebSocket } from "../services/websocket";

/**
 * Opens the WebSocket once and streams incoming trace events into state.
 * Pausing is handled inside the stable message callback via a ref, so
 * changing `paused` never tears down and re-opens the socket.
 */
export function useTraceStream() {
    const [eventsByRequest, setEventsByRequest] = useState({});
    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [paused, setPaused] = useState(false);
    // The most recently received event — used to drive tree particle animation
    const [latestEvent, setLatestEvent] = useState(null);

    // Use a ref so the message handler closure always reads the latest value
    // without being a dependency that causes the effect to re-run.
    const pausedRef = useRef(paused);
    const selectedRequestIdRef = useRef(selectedRequestId);

    useEffect(() => { pausedRef.current = paused; }, [paused]);
    useEffect(() => { selectedRequestIdRef.current = selectedRequestId; }, [selectedRequestId]);

    useEffect(() => {
        connectWebSocket((event) => {
            if (pausedRef.current) return;

            setLatestEvent(event);
            setEventsByRequest((prev) => {
                    const requestId = event.requestId;
                    const existing = prev[requestId] ?? [];
                    const next = { ...prev, [requestId]: [...existing, event] };

                    if (!selectedRequestIdRef.current) {
                        setSelectedRequestId(requestId);
                    }

                    return next;
                });
        });

        return () => disconnectWebSocket();
    }, []); // empty deps — connect once, never reconnect on state changes

    const clearAll = () => {
        setEventsByRequest({});
        setSelectedRequestId(null);
    };

    return {
        eventsByRequest,
        selectedRequestId,
        setSelectedRequestId,
        paused,
        setPaused,
        clearAll,
        latestEvent,
    };
}
