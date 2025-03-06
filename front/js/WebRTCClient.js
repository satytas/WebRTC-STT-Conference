const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:3478" }
];

export class WebRTCClient {
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
        this.channelWS.send(JSON.stringify({target, type, data, from: this.userId }));
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