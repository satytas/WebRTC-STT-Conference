import { EventTypes } from './main.js';

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
        this.remoteUserId = null;
        
        // Track media states
        this.isAudioMuted = true;
        this.isVideoOff = true;

        this.signalingClient.setHandler(EventTypes.SERVER_NEW_USER, this.handleNewUser.bind(this));
        this.signalingClient.setHandler(EventTypes.PEER_OFFER, this.handleOffer.bind(this));
        this.signalingClient.setHandler(EventTypes.PEER_ANSWER, this.handleAnswer.bind(this));
        this.signalingClient.setHandler(EventTypes.PEER_ICE_CANDIDATE, this.handleIceCandidate.bind(this));
        this.signalingClient.setHandler(EventTypes.PEER_USER_LEFT, this.handleUserLeft.bind(this));
        
        console.log(`U- ${this.userId}'s WebRTCClient`);
    }

    async initialize() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            this.toggleMute();
            this.toggleVideo();
            
            document.getElementById('localVideo').srcObject = this.localStream;
            
            // Display local user ID
            document.getElementById('localUserId').textContent = this.userId;
            
            // Initialize media status indicators
            this.updateStatusIndicators();
            
            await this.createPeerConnection();
            console.log(`U- ${this.userId}'s WebRTCClient initialized with local stream`);
        } catch (err) {
            console.error("Failed to initialize media:", err);
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
            console.log(`U- ${this.userId} Received remote track`);
        };

        this.peerConnection.onicecandidate = event => {
            if (event.candidate) {
                this.sendToAllUsers(EventTypes.PEER_ICE_CANDIDATE, event.candidate);
                console.log(`U- ${this.userId} Sent ICE candidate`, event.candidate);
            }
        };

        console.log(`U- ${this.userId} Created a Peer Connection`);
    }

    async handleNewUser(data) {
        const { userId } = data;
        this.users.add(userId);
        this.remoteUserId = userId;
        
        // Update remote user ID display
        document.getElementById('remoteUserId').textContent = userId;
        
        // Update participant count
        document.getElementById('participantCount').textContent = `${this.users.size + 1}/2`;

        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        this.sendToUser(userId, EventTypes.PEER_OFFER, offer);
        console.log(`U- ${this.userId} Created and Sent Offer to- ${userId}`);
    }

    async handleOffer(data) {
        const { from, data: offer } = data;
        
        // Set remote user ID
        this.remoteUserId = from;
        document.getElementById('remoteUserId').textContent = from;
        
        // Update participant count
        document.getElementById('participantCount').textContent = `${this.users.size + 1}/2`;
    
        if (this.peerConnection.signalingState !== "stable") {
            console.warn("Peer connection is not in a valid state to accept an offer:", this.peerConnection.signalingState);
            return;
        }
    
        await this.peerConnection.setRemoteDescription(offer);
        console.log(`U- ${this.userId} Received Offer from- ${from}`);

        const answer = await this.peerConnection.createAnswer();

        if (this.peerConnection.signalingState === "have-remote-offer") {
            await this.peerConnection.setLocalDescription(answer);

            this.sendToUser(from, EventTypes.PEER_ANSWER, answer);
            console.log(`U- ${this.userId} Sent back an Answer to- ${from}`);
        } else {
            console.warn("Unexpected signaling state before setting local description:", this.peerConnection.signalingState);
        }
    }    

    async handleAnswer(data) {
        const { data: answer } = data;
        await this.peerConnection.setRemoteDescription(answer);

        console.log(`U- ${this.userId} Received and Set Answer`);
    }

    async handleIceCandidate(data) {
        const { data: candidate } = data;

        await this.peerConnection.addIceCandidate(candidate);
        console.log(`U- ${this.userId} Added ICE candidate`, candidate);
    }

    async handleUserLeft(data) {
        this.users.delete(data.userId);
        this.remoteUserId = null;
        document.getElementById('remoteVideo').srcObject = null;
        document.getElementById('remoteUserId').textContent = "waiting...";
        document.getElementById('participantCount').textContent = `1/2`;
        
        this.peerConnection.close();
        console.log(`${data.userId} left, closed peer connection`);

        console.log("Recreating peer connection");
        await this.createPeerConnection();
    }

    sendToUser(target, type, data) {
        this.signalingClient.sendToUser(target, type, data);
    }

    sendToAllUsers(type, data) {
        this.users.forEach(memberId => this.sendToUser(memberId, type, data));
    }

    toggleMute = () => {
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            this.isAudioMuted = !audioTrack.enabled;
            
            // Update UI
            const muteBtn = document.getElementById('muteBtn');
            const muteText = document.getElementById('muteButtonText');
            
            if (this.isAudioMuted) {
                muteBtn.classList.add('active');
                muteText.textContent = "Unmute";
            } else {
                muteBtn.classList.remove('active');
                muteText.textContent = "Mute";
            }
            
            this.updateStatusIndicators();
        }
    }
    
    toggleVideo = () => {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            this.isVideoOff = !videoTrack.enabled;
            
            // Update UI
            const videoBtn = document.getElementById('videoBtn');
            const videoText = document.getElementById('videoButtonText');
            
            if (this.isVideoOff) {
                videoBtn.classList.add('active');
                videoText.textContent = "Video On";
            } else {
                videoBtn.classList.remove('active');
                videoText.textContent = "Video Off";
            }
            
            this.updateStatusIndicators();
        }
    };

    updateStatusIndicators() {
        // Local audio status
        const localAudioStatus = document.getElementById('localAudioStatus');
        if (this.isAudioMuted) {
            localAudioStatus.classList.add('muted');
        } else {
            localAudioStatus.classList.remove('muted');
        }
        
        // Local video status
        const localVideoStatus = document.getElementById('localVideoStatus');
        if (this.isVideoOff) {
            localVideoStatus.classList.add('video-off');
        } else {
            localVideoStatus.classList.remove('video-off');
        }
    }

    disconnect() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    
        if(this.localStream){
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
    
        if(this.remoteStream){
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
    
        this.users.clear();
        this.roomId = null;
        this.remoteUserId = null;
    }
}