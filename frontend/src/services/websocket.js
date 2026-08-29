// Reconnect configuration
const RECONNECT_BASE_DELAY_MS = 1000;   // initial wait before first retry
const RECONNECT_MAX_DELAY_MS  = 30000;  // cap at 30 s
const RECONNECT_MULTIPLIER    = 2;      // doubles each attempt

let socket = null;
let reconnectAttempt = 0;
let reconnectTimer = null;
let stopped = false;          // set to true by disconnectWebSocket() to cancel retries
let activeOnMessage = null;   // retained so reconnects re-attach the same handler

// Get WebSocket URL from environment or use default.
// Supports: VITE_WS_URL, VITE_API_URL, or defaults to localhost:8080.
// The token is no longer appended as a query parameter (which would appear
// in server access logs and browser history). Instead it is passed via the
// Sec-WebSocket-Protocol subprotocol field — the only place the browser
// WebSocket API allows carrying extra data on the upgrade request.
function getWebSocketUrl() {
    if (import.meta.env.VITE_WS_URL) {
        return import.meta.env.VITE_WS_URL;
    }
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL.replace(/^http/, 'ws') + '/ws/traces';
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//localhost:8080/ws/traces`;
}

/**
 * Return the subprotocol list to pass to new WebSocket(url, protocols).
 * When VITE_WS_TOKEN is set the token is sent as a subprotocol value so
 * it never appears in URLs, access logs, or browser history.
 */
function getSubprotocols() {
    const token = import.meta.env.VITE_WS_TOKEN;
    if (token && token.trim() !== '') {
        return ['trace', `token.${token.trim()}`];
    }
    return [];
}

function scheduleReconnect() {
    if (stopped) return;

    const delay = Math.min(
        RECONNECT_BASE_DELAY_MS * Math.pow(RECONNECT_MULTIPLIER, reconnectAttempt),
        RECONNECT_MAX_DELAY_MS
    );
    reconnectAttempt += 1;
    console.log(`WebSocket: reconnecting in ${delay}ms (attempt ${reconnectAttempt})…`);

    reconnectTimer = setTimeout(() => {
        if (!stopped) {
            openSocket(activeOnMessage);
        }
    }, delay);
}

function openSocket(onMessage) {
    const wsUrl = getWebSocketUrl();
    const protocols = getSubprotocols();
    socket = protocols.length > 0 ? new WebSocket(wsUrl, protocols) : new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log(`WebSocket connected to ${wsUrl}`);
        reconnectAttempt = 0; // reset backoff on successful connection
    };

    socket.onmessage = (event) => {
        try {
            onMessage(JSON.parse(event.data));
        } catch (err) {
            console.error('WebSocket: failed to parse message', err);
        }
    };

    socket.onclose = (event) => {
        // code 1000 = normal closure (triggered by disconnectWebSocket)
        if (stopped || event.code === 1000) {
            console.log('WebSocket disconnected (clean).');
            return;
        }
        console.warn(`WebSocket closed (code ${event.code}), will retry.`);
        scheduleReconnect();
    };

    socket.onerror = (error) => {
        // onclose fires right after onerror, so we only log here
        console.error('WebSocket error:', error);
    };
}

/**
 * Connect to the trace WebSocket. Automatically reconnects on unexpected
 * disconnects using exponential backoff (1 s → 2 s → 4 s … capped at 30 s).
 *
 * @param {function} onMessage  Called with each parsed trace event object.
 */
export function connectWebSocket(onMessage) {
    stopped = false;
    reconnectAttempt = 0;
    activeOnMessage = onMessage;
    openSocket(onMessage);
}

/**
 * Permanently disconnect and cancel any pending reconnect timers.
 */
export function disconnectWebSocket() {
    stopped = true;
    clearTimeout(reconnectTimer);
    if (socket) {
        socket.close(1000, 'Client disconnected');
        socket = null;
    }
}
