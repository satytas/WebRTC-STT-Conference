import { WebRTCClient } from './WebRTCClient.js';

// DOM references
const landing = document.getElementById('landing');
const roomDiv = document.getElementById('room');
const joinPrompt = document.getElementById('joinPrompt');
const createPrompt = document.getElementById('createPrompt');
const passwordPrompt = document.getElementById('passwordPrompt');

const client = new WebRTCClient();
let roomId = new URLSearchParams(window.location.search).get('room_id')
function getUserId(){
    let userId = sessionStorage.getItem('userId');
    if (!userId) {
        userId = Math.random().toString(36).slice(2, 6);
        sessionStorage.setItem('userId', userId);
    }
    return userId;
}
console.log("userId: ", getUserId());


//Routing
async function handleRouting(){
    const page = window.location.pathname.split("?")[0];

    switch (page) {
        case '/create_room':
            showPage(createPrompt);
            break;
        case '/join_room':
            showPage(joinPrompt);
            break;
        case '/room':
            if(new URLSearchParams(window.location.search).get('room_id')?.match(/^[a-zA-Z0-9_-]+$/)){
                showPage(roomDiv);
                await client.initialize();
                client.connectWebSocket(roomId, getUserId());
                document.getElementById('roomIdDisplay').textContent = roomId;
            }
            else{
                window.history.pushState({}, '', '/');
                showPage(landing);
            }
            
            break;
        default:
            window.history.pushState({}, '', '/');
            showPage(landing);
            break;
    }
}

window.addEventListener('load', async () => handleRouting())

window.addEventListener('popstate', async () => handleRouting())


//UI
function showPage(page) {
    landing.style.display = 'none';
    joinPrompt.style.display = 'none';
    createPrompt.style.display = 'none';
    roomDiv.style.display = 'none';
    passwordPrompt.style.display = 'none';

    page.style.display = 'block';
}

document.getElementById('createPromptBtn').addEventListener('click', () => {
    window.history.pushState({}, '', '/create_room');
    showPage(createPrompt);
});
document.getElementById('createPromptJoinBtn').addEventListener('click', async () => {
    const password = document.getElementById('createPasswordInput').value.trim();

    const ws = new WebSocket("ws://localhost:8080");
    ws.onopen = () => {
        ws.send(JSON.stringify({
            type: 'create-room',
            password: password || null
        }));
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'room-created') {
            if (data.success) {
                ws.close();

                roomId = data.roomId
                window.history.pushState({}, '', `/room?room_id=${roomId}`);
                showPage(roomDiv);
                document.getElementById('roomIdDisplay').textContent = roomId;

                await client.initialize();
                client.connectWebSocket(roomId, getUserId());
            } else {
                alert(data.message);
            }
        }
    };
});
document.getElementById('createPromptBackBtn').addEventListener('click', () => {
    window.history.pushState({}, '', '/');
    document.getElementById('createPasswordInput').value = '';
    showPage(landing);
})
document.getElementById('joinPromptBtn').addEventListener('click', () => {
    window.history.pushState({}, '', '/join_room');
    landing.style.display = 'none';
    joinPrompt.style.display = 'block';
});
document.getElementById('joinPromptBackBtn').addEventListener('click', () => {
    document.getElementById('roomIdInput').value = '';
    showPage(landing);
    window.history.pushState({}, '', '/');
});
document.getElementById('joinPromptJoinBtn').addEventListener('click', async () => {
    roomId = document.getElementById('roomIdInput').value.trim();
    if (!roomId) return alert('Please enter a Room ID');

    const ws = new WebSocket('ws://localhost:8080');
    ws.onopen = () => {
        ws.send(JSON.stringify({
            type: 'validate-room',
            roomId,
            password: null
        }));
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'room-validation') {
            ws.close();
            if (!data.exists) {
                alert('Room does not exist');
            } else if (!data.passwordRequired) {
                window.history.pushState({}, '', `/room?room_id=${roomId}`);
                showPage(roomDiv);
                document.getElementById('roomIdDisplay').textContent = roomId;
                await client.initialize();
                client.connectWebSocket(roomId, getUserId());
            } else {
                showPage(passwordPrompt);
            }
        }
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        alert('Failed to validate room');
    };
});
document.getElementById('inviteBtn').addEventListener('click', () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => alert('Room URL copied to clipboard!'));
});
document.getElementById('leaveRoomBtn').addEventListener('click', () => {
    window.history.pushState({}, '', '/');
    client.disconnect();
    showPage(landing);
});
document.getElementById('passwordPromptJoinBtn').addEventListener('click', async () => {
    const password = document.getElementById('passwordPromptInput').value.trim();

    const ws = new WebSocket('ws://localhost:8080');
    ws.onopen = () => {
        ws.send(JSON.stringify({
            type: 'validate-room',
            roomId,
            password
        }));
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'room-validation') {
            ws.close();
            if (data.exists && data.passwordRequired && data.passwordCorrect) {
                window.history.pushState({}, '', `/room?room_id=${roomId}`);
                showPage(roomDiv);
                document.getElementById('roomIdDisplay').textContent = roomId;
                await client.initialize();
                client.connectWebSocket(roomId, getUserId());
            } else {
                alert('Incorrect password');
            }
        }
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        alert('Failed to validate password');
    };
});
document.getElementById('passwordPromptBackBtn').addEventListener('click', () => {
    showPage(joinPrompt);
    document.getElementById('passwordPromptInput').value = '';
});
document.getElementById('copyRoomIdBtn').addEventListener('click', () => {
    const roomIdText = document.getElementById('roomIdDisplay').textContent;
    navigator.clipboard.writeText(roomIdText).then(() => alert('Room ID copied to clipboard!'));
});