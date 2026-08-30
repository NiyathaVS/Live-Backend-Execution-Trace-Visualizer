import { useEffect, useRef, useState } from "react";
import { connectWebSocket, disconnectWebSocket } from "../services/websocket";

/**
 * Opens the WebSocket once and streams incoming trace events into state.
 * Pausing is handled inside the stable message callback via a ref, so
 * changing `paused` never tears down and re-opens the socket.
 *
 * autoFollow — when true, the view automatically switches to each new
 * incoming request as it arrives (default on). Flips to false when the
 * user explicitly clicks a trace, so they can inspect it without losing
 * their place mid-scroll.
 */
export function useTraceStream() {
    const [eventsByRequest, setEventsByRequest] = useState({});
    const [selectedRequestId, setSelectedRequestId] = useState(null);
    const [paused, setPaused] = useState(false);
    const [autoFollow, setAutoFollow] = useState(true);
    // The most recently received event — used to drive tree particle animation
    const [latestEvent, setLatestEvent] = useState(null);

    // Use refs so the message handler closure always reads the latest values
    // without being a dependency that causes the effect to re-run.
    const pausedRef = useRef(paused);
    const autoFollowRef = useRef(autoFollow);

    useEffect(() => { pausedRef.current = paused; }, [paused]);
    useEffect(() => { autoFollowRef.current = autoFollow; }, [autoFollow]);

    useEffect(() => {
        connectWebSocket((event) => {
            if (pausedRef.current) return;

            setLatestEvent(event);
            setEventsByRequest((prev) => {
                const requestId = event.requestId;
                const existing = prev[requestId] ?? [];
                const next = { ...prev, [requestId]: [...existing, event] };

                // Auto-follow: always switch to the newest distinct request
                // when no user has pinned their selection.
                if (autoFollowRef.current && !existing.length) {
                    // Only trigger on the first event of a new request
                    setSelectedRequestId(requestId);
                }

                return next;
            });
        });

        return () => disconnectWebSocket();
    }, []); // empty deps — connect once, never reconnect on state changes

    // When the user explicitly selects a trace, stop auto-following
    const selectTrace = (requestId) => {
        setAutoFollow(false);
        setSelectedRequestId(requestId);
    };

    const clearAll = () => {
        setEventsByRequest({});
        setSelectedRequestId(null);
        setAutoFollow(true);
    };

    return {
        eventsByRequest,
        selectedRequestId,
        setSelectedRequestId: selectTrace,
        autoFollow,
        setAutoFollow,
        paused,
        setPaused,
        clearAll,
        latestEvent,
    };
}
