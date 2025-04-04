import { WebSocketServer } from 'ws';
import { EventTypes } from '../../front/src/utils/EventTypes.js';

const wss = new WebSocketServer({ port: 8080 });

const rooms = new Map(); // Map<roomId, Map<ws, userId>>

//WEBSOCKET.OPEN = 1 due to changing import

wss.on('connection', ws => {
  ws.on('message', message => {
    const data = JSON.parse(message);

    switch (data.type) {
      //client to server
      case EventTypes.CLIENT_JOIN_ROOM: {
        const { roomId, userId } = data;
        const room = rooms.get(roomId) || rooms.set(roomId, new Map()).get(roomId);

        room.set(ws, userId);
        ws.send(JSON.stringify({ type: EventTypes.SERVER_WELCOME, userId, roomId }));
        console.log(`User ${userId} joined room ${roomId} (${room.size}) | `);

        for (const [client] of room)
          if (client !== ws && client.readyState === 1)
            client.send(JSON.stringify({ type: EventTypes.SERVER_NEW_USER, userId }));

      } break;

      case EventTypes.CLIENT_CREATE_ROOM: {
        const roomId = Math.random().toString(36).slice(2, 10);
        const room = new Map();
        console.log("PASSWORD: ", data.password);
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
        const room = rooms.get(data.roomId);

        if (!room) {
          ws.send(JSON.stringify({
            type: EventTypes.SERVER_PASSWORD_VALIDATION,
            success: false,
            error: "Room not found"
          }));
          return;
        }

        ws.send(JSON.stringify({
          type: EventTypes.SERVER_PASSWORD_VALIDATION,
          success: room.password === data.password
        }));
      } break;

      //client to client
      default: {
        for (const [roomId, users] of rooms) {
          if (users.has(ws)) {
            const senderId = users.get(ws);
            
            for (const [client, id] of users) {
              if (id === data.target && client.readyState === 1)
                client.send(JSON.stringify({ ...data, from: senderId }));
            }
            break;
          }
        }
      } break;
    }
  });

  ws.on('close', () => {
    for (const [roomId, users] of rooms) {
      if (users.has(ws)) {
        const userId = users.get(ws);
        users.delete(ws);

        console.log(`User ${userId} disconnected from room ${roomId} (WebSocket closed)`);

        if (users.size > 0) {
          for (const [client, id] of users) {
            if (client.readyState === 1) {
              client.send(JSON.stringify({
                type: EventTypes.PEER_USER_LEFT,
                userId: userId
              }));
            }
          }
        }

        if (users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted because it's empty`);
        }

        break;
      }
    }
  });
});

console.log('WebSocket server running on ws://localhost:8080');