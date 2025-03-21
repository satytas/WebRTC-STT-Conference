import { SignalingClient } from './SignalingClient.js';
import { WebRTCClient } from './WebRTCClient.js';

const EventTypes = Object.freeze({
    // Client to Server events
    CLIENT_JOIN_ROOM: "client:join-room",
    CLIENT_CREATE_ROOM: "client:create-room",
    CLIENT_VALIDATE_ROOM: "client:validate-room",
    CLIENT_VALIDATE_PASSWORD: "client:validate-password",
    CLIENT_DISCONNECT: "client:disconnect",

    // Server to Client events
    SERVER_WELCOME: "server:welcome",
    SERVER_ROOM_CREATED: "server:room-created",
    SERVER_ROOM_VALIDATION: "server:room-validation",
    SERVER_PASSWORD_VALIDATION: "server:password-validation",
    SERVER_NEW_USER: "server:new-user",

    // Client to Client (WebRTC) events
    PEER_OFFER: "peer:offer",
    PEER_ANSWER: "peer:answer",
    PEER_ICE_CANDIDATE: "peer:ice-candidate",
    PEER_USER_LEFT: "peer:user-left"
});

// DOM references
const landing = document.getElementById('landing');
const roomDiv = document.getElementById('room');
const joinPrompt = document.getElementById('joinPrompt');
const createPrompt = document.getElementById('createPrompt');
const passwordPrompt = document.getElementById('passwordPrompt');


let roomId = new URLSearchParams(window.location.search).get('room_id');
const userId = sessionStorage.getItem("userId") || (sessionStorage.setItem("userId", Math.random().toString(36).slice(2, 6)), sessionStorage.getItem("userId"));

const signalingClient = new SignalingClient(userId);
const webRTCClient = new WebRTCClient(signalingClient);

window.addEventListener('load', () => handleRouting());
window.addEventListener('popstate', () => handleRouting());


// Routing
async function handleRouting() {
    const page = window.location.pathname.split("?")[0];
    switch (page) {
        case '/create_room':
            showPage(createPrompt);
            break;
        case '/join_room':
            showPage(joinPrompt);
            break;
        case '/room':
            if (roomId?.match(/^[a-zA-Z0-9_-]+$/)) {
                console.log("trying entering room from link prolly");
                
                await webRTCClient.initialize();
                await signalingClient.enterRoom(roomId);

                console.log("finishde the await enter room");
                showPage(roomDiv);
                document.getElementById('roomIdDisplay').textContent = roomId;
                
            } else {
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
function showPage(page) {
    landing.style.display = 'none';
    joinPrompt.style.display = 'none';
    createPrompt.style.display = 'none';
    roomDiv.style.display = 'none';
    passwordPrompt.style.display = 'none';
    page.style.display = 'block';
}

// Event Listeners
document.getElementById('joinPromptJoinBtn').addEventListener('click', async () => {
    roomId = document.getElementById('roomIdInput').value.trim();
    if (!roomId) return alert('Please enter a Room ID');

    try {
        const result = await signalingClient.validateRoom(roomId);
        console.log("tried connecting with room, res- ", result);
        if (!result.exists) {
            alert('Room does not exist');
        } else if (!result.passwordRequired) {
            await webRTCClient.initialize();
            await signalingClient.enterRoom(roomId);
            showPage(roomDiv);
            document.getElementById('roomIdDisplay').textContent = roomId;
            
        } else {
            console.log("aight moving to pass prompt");
            showPage(passwordPrompt);
        }
    } catch (err) {
        console.error(err);
    }
});
document.getElementById('passwordPromptJoinBtn').addEventListener('click', async () => {
    const password = document.getElementById('passwordPromptInput').value.trim();
    try {
        console.log("trying to validate password");
        const result = await signalingClient.validatePassword(roomId, password);
        console.log("validated password");

        console.log("tried connecting with room, res- ", result);
        if (result.success) {
            console.log("aight moving to room");
            await webRTCClient.initialize();
            await signalingClient.enterRoom(roomId);
            window.history.pushState({}, '', `/room?room_id=${roomId}`);
            showPage(roomDiv);
            document.getElementById('roomIdDisplay').textContent = roomId;
            
        } else {
            alert('Invalid password');
        }
    } catch (err) {
        console.error(err);
    }
});
document.getElementById('createPromptJoinBtn').addEventListener('click', async () => {
    const password = document.getElementById('createPasswordInput').value.trim();
    try {
        const result = await signalingClient.createRoom(password);

        roomId = result.roomId;

        await webRTCClient.initialize();
        await signalingClient.enterRoom(roomId);

        window.history.pushState({}, '', `/room?room_id=${roomId}`);
        showPage(roomDiv);
        
        document.getElementById('roomIdDisplay').textContent = roomId;

    } catch (err) {
        console.error(err);
    }
});

// Other event listeners
document.getElementById('createPromptBackBtn').addEventListener('click', () => {
    window.history.pushState({}, '', '/');
    document.getElementById('createPasswordInput').value = '';
    showPage(landing);
});
document.getElementById('joinPromptBtn').addEventListener('click', () => {
    window.history.pushState({}, '', '/join_room');
    showPage(joinPrompt);
});
document.getElementById('joinPromptBackBtn').addEventListener('click', () => {
    document.getElementById('roomIdInput').value = '';
    showPage(landing);
    window.history.pushState({}, '', '/');
});
document.getElementById('createPromptBtn').addEventListener('click', () => {
    window.history.pushState({}, '', '/create_room');
    showPage(createPrompt);
});
document.getElementById('inviteBtn').addEventListener('click', () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => alert('Room URL copied to clipboard!'));
});
document.getElementById('leaveRoomBtn').addEventListener('click', () => {
    webRTCClient.disconnect();
    signalingClient.disconnect();
    window.history.pushState({}, '', '/');
    showPage(landing);
});
document.getElementById('passwordPromptBackBtn').addEventListener('click', () => {
    showPage(joinPrompt);
    document.getElementById('passwordPromptInput').value = '';
});
document.getElementById('copyRoomIdBtn').addEventListener('click', () => {
    const roomIdText = document.getElementById('roomIdDisplay').textContent;
    navigator.clipboard.writeText(roomIdText).then(() => alert('Room ID copied to clipboard!'));
});
document.getElementById('muteBtn').addEventListener('click', () => webRTCClient.toggleMute());
document.getElementById('videoBtn').addEventListener('click', () => webRTCClient.toggleVideo());

export { EventTypes };