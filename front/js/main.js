import { WebRTCClient } from './WebRTCClient.js';

// DOM references
const landing = document.getElementById('landing');
const roomDiv = document.getElementById('room');
const joinPrompt = document.getElementById('joinPrompt');
const inviteBtn = document.getElementById('inviteBtn');
const backBtn = document.getElementById('backBtn');

const client = new WebRTCClient();


//return only the "path" after the websites address
function getRoomIdFromUrl() {
    const path = window.location.pathname;

    if (path.length > 1) return path.substring(1);
    else return null;
  }

/*Initialization - checks if there is a path after the address
if it has (bigger then 0) then it will assume we in a room and
will show the room's html elements and create the webRTC client
and start the connection process, else the landing's elements*/
window.addEventListener('load', async () => {
    const roomId = getRoomIdFromUrl();

    if (roomId) {
      showRoom();
      await client.initialize();
      client.connectWebSocket(roomId);
    }
    else showLanding();
});

window.addEventListener('popstate', () => {
    const roomId = getRoomIdFromUrl();

    if (roomId)showRoom();
    else showLanding();
});

function showLanding() {
    landing.style.display = 'block';
    roomDiv.style.display = 'none';
    joinPrompt.style.display = 'none';
    client.disconnect();
}

function showRoom() {
    landing.style.display = 'none';
    roomDiv.style.display = 'block';
    joinPrompt.style.display = 'none';
}


//UI Event listeners
document.getElementById('createRoomBtn').addEventListener('click', async () => {
    const roomId = Math.random().toString(36).substring(2, 8); // Random 6-char ID
    window.history.pushState({}, '', `/${roomId}`);
    showRoom();
    await client.initialize();
    client.connectWebSocket(roomId);
});
document.getElementById('joinRoomBtn').addEventListener('click', () => {
    window.history.pushState({}, '', '/join');
    landing.style.display = 'none';
    joinPrompt.style.display = 'block';
});
document.getElementById('joinBackBtn').addEventListener('click', () => {
    document.getElementById('roomIdInput').value = '';
    showLanding()
    window.history.pushState({}, '', '/');
});
document.getElementById('joinSubmitBtn').addEventListener('click', async () => {
    const roomId = document.getElementById('roomIdInput').value.trim();
    if (!roomId) return alert('Please enter a Room ID');
    window.history.pushState({}, '', `/${roomId}`);
    document.getElementById('roomIdInput').value = '';
    showRoom();
    await client.initialize();
    client.connectWebSocket(roomId);
});
inviteBtn.addEventListener('click', () => {
    const url = window.location.href;// the full address
    navigator.clipboard.writeText(url).then(() => alert('Room URL copied to clipboard!'));
});
backBtn.addEventListener('click', () => {
    window.history.pushState({}, '', '/');
    showLanding();
});