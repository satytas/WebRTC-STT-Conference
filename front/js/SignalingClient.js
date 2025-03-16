export class SignalingClient {
    constructor(userId) {
        this.userId = userId;
        this.ws = new WebSocket("ws://localhost:8080");
        this.pendingRequests = {}; // Store promise resolvers for request-response
        this.handlers = {}; // Store handlers for event-based messages

        this.ws.onopen = () => console.log("WebSocket connected");
        this.ws.onerror = (err) => console.error("WebSocket error:", err);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            // Handle request-response messages
            if (this.pendingRequests[data.type]) {
                this.pendingRequests[data.type].resolve(data);
                this.pendingRequests[data.type] = null;
            }
            // Handle event-based messages (e.g., WebRTC signaling)
            else if (this.handlers[data.type]) {
                this.handlers[data.type](data);
            }
        };
    }

    // Register handlers for WebRTC signaling messages
    setHandler(type, handler) {
        this.handlers[type] = handler;
    }

    // Send messages to specific users (for WebRTC signaling)
    sendToUser(target, type, data) {
        this.ws.send(JSON.stringify({ target, type, data, from: this.userId }));
    }

    // Create a room
    createRoom(password) {
        return new Promise((resolve, reject) => {
            if (this.pendingRequests['room-created']) {
                reject(new Error("Another room creation is in progress"));
                return;
            }
            this.pendingRequests['room-created'] = { resolve, reject };
            this.ws.send(JSON.stringify({ type: 'create-room', password: password || null }));
        });
    }

    // Validate a room
    validateRoom(roomId) {
        return new Promise((resolve, reject) => {
            if (this.pendingRequests['room-validation']) {
                reject(new Error("Another validation is in progress"));
                return;
            }
            this.pendingRequests['room-validation'] = { resolve, reject };
            this.ws.send(JSON.stringify({ type: 'validate-room', roomId }));
        });
    }

    // Validate a password
    validatePassword(roomId, password) {
        return new Promise((resolve, reject) => {
            if (this.pendingRequests['password-validation']) {
                reject(new Error("Another password validation is in progress"));
                return;
            }
            this.pendingRequests['password-validation'] = { resolve, reject };
            this.ws.send(JSON.stringify({ type: 'validate-password', roomId, password }));
        });
    }

    // Enter a room
    enterRoom(roomId) {
        return new Promise((resolve, reject) => {
            if (this.pendingRequests['welcome']) {
                reject(new Error("Already joining a room"));
                return;
            }
            this.pendingRequests['welcome'] = { resolve, reject };
            this.ws.send(JSON.stringify({ type: 'join-room', roomId, userId: this.userId }));
        });
    }

    disconnect() {
        this.ws.close();
    }
}