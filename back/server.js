const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map(); // Map<roomId, Map<ws, userId>>

wss.on('connection', ws => {
    ws.on('message', message => {
        const data = JSON.parse(message);
        if (data.type === 'join-room') {
            const roomId = data.roomId;
            if (!rooms.has(roomId)) rooms.set(roomId, new Map());
            const room = rooms.get(roomId);
            const userId = String(Math.floor(Math.random() * 100));
            room.set(ws, userId);

            ws.send(JSON.stringify({ type: 'welcome', userId, roomId }));
            console.log(`User ${userId} joined room ${roomId}`);

            for (const [client, id] of room) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'new-user', userId }));
                }
            }
        } else {
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