const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:3478" }
];

export class WebRTCClient {
    constructor(signalingClient) {
        this.signalingClient = signalingClient;
        this.userId = signalingClient.userId;
        this.roomId = null;
        this.users = new Set();
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;

        // Register handlers for WebRTC signaling messages
        this.signalingClient.setHandler('new-user', this.handleNewUser.bind(this));
        this.signalingClient.setHandler('offer', this.handleOffer.bind(this));
        this.signalingClient.setHandler('answer', this.handleAnswer.bind(this));
        this.signalingClient.setHandler('ice-candidate', this.handleIceCandidate.bind(this));
        this.signalingClient.setHandler('user-left', this.handleUserLeft.bind(this));
        console.log(`WebRTCClient initialized for user: ${this.userId}`);
    }

    // Initialize media and peer connection
    async initialize() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            document.getElementById('localVideo').srcObject = this.localStream;
            await this.createPeerConnection();
            console.log("WebRTCClient initialized with local stream");
        } catch (err) {
            console.error("Failed to initialize media:", err);
        }
    }

    // Create a new peer connection
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
            console.log("Received remote track");
        };

        this.peerConnection.onicecandidate = event => {
            if (event.candidate) {
                this.sendToAllUsers('ice-candidate', event.candidate);
                console.log("Sent ICE candidate", event.candidate);
            }
        };
        console.log("Peer connection created");
    }

    // Handle a new user joining
    async handleNewUser(data) {
        const { userId } = data;
        this.users.add(userId);
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        this.sendToUser(userId, 'offer', offer);
        console.log(`Created and sent offer to user: ${userId}`);
    }

    // Handle an incoming offer
    async handleOffer(data) {
        const { from, data: offer } = data;
        await this.peerConnection.setRemoteDescription(offer);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.sendToUser(from, 'answer', answer);
        console.log(`Received offer from ${from}, sent answer`);
    }

    // Handle an incoming answer
    async handleAnswer(data) {
        const { data: answer } = data;
        await this.peerConnection.setRemoteDescription(answer);
        console.log("Received and set answer");
    }

    // Handle an incoming ICE candidate
    async handleIceCandidate(data) {
        const { data: candidate } = data;
        await this.peerConnection.addIceCandidate(candidate);
        console.log("Added ICE candidate", candidate);
    }

    // Handle a user leaving
    handleUserLeft(data) {
        this.users.delete(data.userId);
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
            document.getElementById('remoteVideo').srcObject = null;
            console.log(`User ${data.userId} left, closed peer connection`);
        }
    }

    // Send a message to a specific user
    sendToUser(target, type, data) {
        this.signalingClient.sendToUser(target, type, data);
    }

    // Send a message to all users
    sendToAllUsers(type, data) {
        this.users.forEach(memberId => this.sendToUser(memberId, type, data));
    }

    // Clean up WebRTC resources
    disconnect() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        this.users.clear();
        this.roomId = null;
        console.log("WebRTCClient disconnected");
    }
}