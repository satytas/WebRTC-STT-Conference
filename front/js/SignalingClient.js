import { EventTypes } from './main.js';

export class SignalingClient {
    constructor(userId) {
        this.userId = userId;
        this.pendingRequests = {};
        this.handlers = {};
        
        this.ws = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket("ws://localhost:8080");

            this.ws.onopen = () => resolve();

            this.ws.onerror = (err) => {
                console.error("WebSocket error:", err);
                reject(new Error("Failed to connect to WebSocket server"));
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (this.pendingRequests[data.type]) {
                    this.pendingRequests[data.type].resolve(data);
                    this.pendingRequests[data.type] = null;
                }
                else if (this.handlers[data.type])
                    this.handlers[data.type](data);
            };
        });
    }

    setHandler(type, handler) { this.handlers[type] = handler }
    
    sendToUser(target, type, data) {
        this.ws.send(JSON.stringify({ target, type, data, from: this.userId }))
    }

    async createRoom(password) {
        if(this.ws === null) await this.connect();

        return new Promise((resolve, reject) => {
            if (this.pendingRequests[EventTypes.SERVER_ROOM_CREATED]) {
                reject(new Error("Another room creation is in progress"));
                return;
            }

            this.pendingRequests[EventTypes.SERVER_ROOM_CREATED] = { resolve, reject };
            this.ws.send(JSON.stringify({ type: EventTypes.CLIENT_CREATE_ROOM, password: password || null }));
        });
    }

    async validateRoom(roomId) {
        if(this.ws === null) await this.connect();

        return new Promise((resolve, reject) => {
            if (this.pendingRequests[EventTypes.SERVER_ROOM_VALIDATION]) {
                reject(new Error("Another validation is in progress"));
                return;
            }
            
            this.pendingRequests[EventTypes.SERVER_ROOM_VALIDATION] = { resolve, reject };
            this.ws.send(JSON.stringify({ type: EventTypes.CLIENT_VALIDATE_ROOM, roomId }));
        });
    }

    validatePassword(roomId, password) {
        return new Promise((resolve, reject) => {
            if (this.pendingRequests[EventTypes.SERVER_PASSWORD_VALIDATION]) {
                reject(new Error("Another password validation is in progress"));
                return;
            }

            this.pendingRequests[EventTypes.SERVER_PASSWORD_VALIDATION] = { resolve, reject };
            this.ws.send(JSON.stringify({ type: EventTypes.CLIENT_VALIDATE_PASSWORD, roomId, password }));
        });
    }

    async enterRoom(roomId) {
        if(this.ws === null) await this.connect();

        return new Promise((resolve, reject) => {
            if (this.pendingRequests[EventTypes.SERVER_WELCOME]) {
                reject(new Error("Already joining a room"));
                console.log("Already joining a room");
                return;
            }

            console.log("sending join room, wating for welcome");
            this.pendingRequests[EventTypes.SERVER_WELCOME] = { resolve, reject };
            this.ws.send(JSON.stringify({ type: EventTypes.CLIENT_JOIN_ROOM, roomId, userId: this.userId }));
        });
    }

    disconnect() {
        this.ws.close();
        this.ws = null;
    }
}