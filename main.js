function getRoomIdFromUrl() {
    const path = window.location.pathname;
    if (path.length > 1) {
      return path.substring(1); // e.g., '92vy3b' from '/92vy3b'
    }
    return null;
  }

window.addEventListener('load', async () => {
    const roomId = getRoomIdFromUrl();
    if (roomId) {
      showRoom(); // Your function to show the room UI
      await client.initialize(); // Your WebRTC client init (if applicable)
      client.connectWebSocket(roomId); // Connect to the room
    } else {
      showLanding(); // Your function to show the landing page
    }
});

window.addEventListener('popstate', () => {
    const roomId = getRoomIdFromUrl();
    if (roomId) {
        showRoom();
    } else {
        showLanding();
    }
});

const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:3478" }
];

class WebRTCClient {
    constructor() {
        this.userId = null;
        this.roomId = null;
        this.users = new Set();
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.channelWS = null;
    }

    async initialize() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            document.getElementById('localVideo').srcObject = this.localStream;
            await this.createPeerConnection();
        } catch (err) {
            console.error('Failed to initialize media:', err);
        }
    }

    async createPeerConnection() {
        this.peerConnection = new RTCPeerConnection({ iceServers });
        this.remoteStream = new MediaStream();
        document.getElementById('remoteVideo').srcObject = this.remoteStream;

        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });

        this.peerConnection.ontrack = event => {
            event.streams[0].getTracks().forEach(track => {
                this.remoteStream.addTrack(track);
            });
        };

        this.peerConnection.onicecandidate = event => {
            if (event.candidate) {
                this.sendToAllUsers('ice-candidate', event.candidate);
            }
        };
    }

    connectWebSocket(roomId) {
        this.roomId = roomId;
        this.channelWS = new WebSocket("ws://localhost:8080");

        this.channelWS.onopen = () => {
            this.channelWS.send(JSON.stringify({
                type: 'join-room',
                roomId: this.roomId,
            }));
        };

        this.channelWS.onmessage = async event => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'welcome':
                    this.userId = data.userId;
                    this.roomId = data.roomId;
                    console.log(`You (${this.userId}) joined room (${this.roomId})`);
                    break;
                case 'new-user':
                    this.users.add(data.userId);
                    this.handleUserJoined(data.userId);
                    break;
                case 'offer':
                    this.createAnswer(data.from, data.data);
                    break;
                case 'answer':
                    this.peerConnection.setRemoteDescription(data.data);
                    break;
                case 'ice-candidate':
                    this.peerConnection.addIceCandidate(data.data);
                    break;
            }
        };

        this.channelWS.onerror = err => console.error('WebSocket error:', err);
    }

    async handleUserJoined(memberId) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        this.sendToUser(memberId, 'offer', offer);
    }

    async createAnswer(memberId, offer) {
        await this.peerConnection.setRemoteDescription(offer);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.sendToUser(memberId, 'answer', answer);
    }

    sendToUser(target, type, data) {
        this.channelWS.send(JSON.stringify({ target, type, data, from: this.userId }));
    }

    sendToAllUsers(type, data) {
        this.users.forEach(memberId => this.sendToUser(memberId, type, data));
    }

    disconnect() {
        if (this.channelWS) {
            this.channelWS.close();
            this.channelWS = null;
        }
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        this.users.clear();
        this.userId = null;
        this.roomId = null;
    }
}

const client = new WebRTCClient();

// UI Logic
const landing = document.getElementById('landing');
const roomDiv = document.getElementById('room');
const joinPrompt = document.getElementById('joinPrompt');
const inviteBtn = document.getElementById('inviteBtn');
const backBtn = document.getElementById('backBtn');

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

document.getElementById('createRoomBtn').addEventListener('click', async () => {
    const roomId = Math.random().toString(36).substring(2, 8); // Random 6-char ID
    window.history.pushState({}, '', `/${roomId}`);
    showRoom();
    await client.initialize();
    client.connectWebSocket(roomId);
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    landing.style.display = 'none';
    joinPrompt.style.display = 'block';
});

document.getElementById('joinSubmitBtn').addEventListener('click', async () => {
    const roomId = document.getElementById('roomIdInput').value.trim();
    if (!roomId) return alert('Please enter a Room ID');
    window.history.pushState({}, '', `/${roomId}`);
    showRoom();
    await client.initialize();
    client.connectWebSocket(roomId);
});

inviteBtn.addEventListener('click', () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => alert('Room URL copied to clipboard!'));
});

backBtn.addEventListener('click', () => {
    window.history.pushState({}, '', '/');
    showLanding();
});