const WebSocket = require('ws');
const EventTypes = Object.freeze({
    // Client to Server events
    CLIENT_JOIN_ROOM: "client:join-room",
    CLIENT_CREATE_ROOM: "client:create-room",
    CLIENT_VALIDATE_ROOM: "client:validate-room",
    CLIENT_VALIDATE_PASSWORD: "client:validate-password",

    // Server to Client events
    SERVER_WELCOME: "server:welcome",
    SERVER_ROOM_CREATED: "server:room-created",
    SERVER_ROOM_VALIDATION: "server:room-validation",
    SERVER_PASSWORD_VALIDATION: "server:password-validation",
    SERVER_NEW_USER: "server:new-user",

    PEER_OFFER: "peer:offer",
    PEER_ANSWER: "peer:answer",
    PEER_ICE_CANDIDATE: "peer:ice-candidate",
    PEER_USER_LEFT: "peer:user-left"
});

const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map(); // Map<roomId, Map<ws, userId>>

wss.on('connection', ws => {
    ws.on('message', message => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case EventTypes.CLIENT_JOIN_ROOM: {
                const { roomId, userId } = data;
                const room = rooms.get(roomId) || rooms.set(roomId, new Map()).get(roomId);
            
                room.set(ws, userId);
                ws.send(JSON.stringify({ type: EventTypes.SERVER_WELCOME, userId, roomId }));
                console.log(`User ${userId} joined room ${roomId}`);
            
                for (const [client] of room)
                    if (client !== ws && client.readyState === WebSocket.OPEN) 
                        client.send(JSON.stringify({ type: EventTypes.SERVER_NEW_USER, userId }));
            
            } break;
        
            case EventTypes.CLIENT_CREATE_ROOM: {
                const roomId = Math.random().toString(36).slice(2, 10);
                const room = new Map();

                room.password = (data.password || null);
                rooms.set(roomId, room);

                ws.send(JSON.stringify({
                    type: EventTypes.SERVER_ROOM_CREATED,
                    roomId: roomId
                }));
            } break;

            case EventTypes.CLIENT_VALIDATE_ROOM: {
                const room = rooms.get(data.roomId);
            
                ws.send(JSON.stringify({
                    type: EventTypes.SERVER_ROOM_VALIDATION,
                    exists: !!room,
                    passwordRequired: room ? room.password !== null : false,
                    passwordCorrect: room ? data.password === room.password : false
                }));
            } break;
            
            case EventTypes.CLIENT_VALIDATE_PASSWORD: {
                ws.send(JSON.stringify({
                    type: EventTypes.SERVER_PASSWORD_VALIDATION,
                    success: rooms.get(data.roomId).password === data.password
                }));
            } break;

            default: {
                for (const [roomId, users] of rooms) {
                    if (users.has(ws)) {
                        const senderId = users.get(ws);
                        for (const [client, id] of users) {
                            if (id === data.target && client.readyState === WebSocket.OPEN)
                                client.send(JSON.stringify({ ...data, from: senderId }));
                        } break;
                    }
                }
            } break;
        }
    });

    ws.on('close', () => {
        for (const [roomId, users] of rooms) {
            if (users.has(ws)) {
                users.delete(ws);
                if (users.size === 0) rooms.delete(roomId);
                break;
            }
        }
    });
});

console.log('WebSocket server running on ws://localhost:8080');