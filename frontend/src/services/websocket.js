let socket;

// Get WebSocket URL from environment or use default
// Supports: VITE_WS_URL, VITE_API_URL, or defaults to localhost:8080
function getWebSocketUrl() {
    // If explicit WebSocket URL is provided
    if (import.meta.env.VITE_WS_URL) {
        return import.meta.env.VITE_WS_URL;
    }
    
    // If API URL is provided, derive WS URL from it
    if (import.meta.env.VITE_API_URL) {
        const apiUrl = import.meta.env.VITE_API_URL;
        return apiUrl.replace(/^http/, 'ws') + '/ws/traces';
    }
    
    // Default to localhost:8080
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//localhost:8080/ws/traces`;
}

export function connectWebSocket(onMessage) {
    const wsUrl = getWebSocketUrl();
    socket = new WebSocket(wsUrl);

    socket.onopen = () => console.log(`WebSocket connected to ${wsUrl}`);

    socket.onmessage = (event) => {
        console.log("Received event:", event.data);
        onMessage(JSON.parse(event.data));
    };

    socket.onclose = () => console.log("WebSocket disconnected");
    socket.onerror = (error) => console.error("WebSocket error:", error);
}


export function disconnectWebSocket() {
    if (socket) {
        socket.close();
    }
}