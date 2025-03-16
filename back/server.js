const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map(); // Map<roomId, Map<ws, userId>>

function addRoom(roomId, password) {
    if (!rooms.has(roomId)) {
        const room = new Map();
        room.password = password;
        rooms.set(roomId, room);
        return true;
    }
    return false;
}

wss.on('connection', ws => {
    ws.on('message', message => {
        const data = JSON.parse(message);
        if (data.type === 'join-room') {
            const roomId = data.roomId;
            const userId = data.userId;
            if (!rooms.has(roomId)) {
                // If the room doesn't exist, create it without a password for joining
                rooms.set(roomId, new Map());
            }
            const room = rooms.get(roomId);
            room.set(ws, userId);

            ws.send(JSON.stringify({ type: 'welcome', userId, roomId }));
            console.log(`User ${userId} joined room ${roomId}`);

            for (const [client, id] of room) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'new-user', userId }));
                }
            }
        } else if (data.type === 'create-room') {
            const roomId = Math.random().toString(36).slice(2, 10);
            const password = data.password || null;
            const success = addRoom(roomId, password);

            ws.send(JSON.stringify({
                type: 'room-created',
                roomId: roomId,
                success,
                message: success ? 'Room created successfully' : 'Room already exists'
            }));
        }
        else if (data.type === 'validate-room') {
            const roomId = data.roomId;
            const providedPassword = data.password;
            if (!rooms.has(roomId)) {
                ws.send(JSON.stringify({ type: 'room-validation', exists: false }));
            } else {
                const room = rooms.get(roomId);
                const roomPassword = room.password;
                if (roomPassword === null) {
                    ws.send(JSON.stringify({ type: 'room-validation', exists: true, passwordRequired: false }));
                } else {
                    if (providedPassword === roomPassword) {
                        ws.send(JSON.stringify({ type: 'room-validation', exists: true, passwordRequired: true, passwordCorrect: true }));
                    } else {
                        ws.send(JSON.stringify({ type: 'room-validation', exists: true, passwordRequired: true, passwordCorrect: false }));
                    }
                }
            }
        }
        else if (data.type === 'validate-password') {
                ws.send(JSON.stringify({ type: 'password-validation', success: rooms.get(data.roomId).password === data.password }));
        }
        else {
            const room = Array.from(rooms.entries()).find(([_, users]) => users.has(ws));
            if (!room) return;
            const senderId = room[1].get(ws);
            sendToUser(room[0], data.target, { ...data, from: senderId });
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

function sendToUser(roomId, userId, data) {
    const room = rooms.get(roomId);
    if (!room) return;
    for (const [ws, id] of room) {
        if (id === userId && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }
}

console.log('WebSocket server running on ws://localhost:8080');