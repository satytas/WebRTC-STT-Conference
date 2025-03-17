const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map(); // Map<roomId, Map<ws, userId>>

wss.on('connection', ws => {
    ws.on('message', message => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'join-room': {
                const { roomId, userId } = data;
                const room = rooms.get(roomId) || rooms.set(roomId, new Map()).get(roomId);
            
                room.set(ws, userId);
                ws.send(JSON.stringify({ type: 'welcome', userId, roomId }));
                console.log(`User ${userId} joined room ${roomId}`);
            
                for (const [client] of room)
                    if (client !== ws && client.readyState === WebSocket.OPEN) 
                        client.send(JSON.stringify({ type: 'new-user', userId }));
            
            } break;
        
            case 'create-room': {
                const roomId = Math.random().toString(36).slice(2, 10);
                const room = new Map();

                room.password = (data.password || null);
                rooms.set(roomId, room);

                ws.send(JSON.stringify({
                    type: 'room-created',
                    roomId: roomId
                }));
            } break;

            case 'validate-room': {
                const room = rooms.get(data.roomId);
            
                ws.send(JSON.stringify({
                    type: 'room-validation',
                    exists: !!room,
                    passwordRequired: room ? room.password !== null : false,
                    passwordCorrect: room ? data.password === room.password : false
                }));
            } break;
            
            case 'validate-password': {
                ws.send(JSON.stringify({
                    type: 'password-validation',
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