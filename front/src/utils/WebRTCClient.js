import { EventTypes } from './EventTypes.js';

const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:3478" }
];

export class WebRTCClient {
  constructor(signalingClient, onNewUser, onUserLeft) {
    this.signalingClient = signalingClient;
    this.userId = signalingClient.userId;
    this.roomId = null;
    this.users = new Set();
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.remoteUserId = null;
    this.onNewUser = onNewUser; // Callback for new user
    this.onUserLeft = onUserLeft; // Callback for user leaving

    console.log(`U- ${this.userId}'s WebRTCClient`);
  }

  async initialize() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false; // Start muted
      }
      await this.createPeerConnection();
      console.log(`U- ${this.userId}'s WebRTCClient initialized with local stream`);
    } catch (err) {
      console.error("Failed to initialize media:", err);
    }
  }

  setHandlers() {
    this.signalingClient.setHandler(EventTypes.SERVER_NEW_USER, this.handleNewUser.bind(this));
    this.signalingClient.setHandler(EventTypes.PEER_OFFER, this.handleOffer.bind(this));
    this.signalingClient.setHandler(EventTypes.PEER_ANSWER, this.handleAnswer.bind(this));
    this.signalingClient.setHandler(EventTypes.PEER_ICE_CANDIDATE, this.handleIceCandidate.bind(this));
    this.signalingClient.setHandler(EventTypes.PEER_USER_LEFT, this.handleUserLeft.bind(this));
  }

  async createPeerConnection() {
    this.peerConnection = new RTCPeerConnection({ iceServers });

    this.remoteStream = new MediaStream();

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
    if (this.onNewUser) this.onNewUser(userId); // Notify Room component

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.sendToUser(userId, EventTypes.PEER_OFFER, offer);
    console.log(`U- ${this.userId} Created and Sent Offer to- ${userId}`);
  }

  async handleOffer(data) {
    const { from, data: offer } = data;
    this.remoteUserId = from;
    if (this.onNewUser) this.onNewUser(from); // Notify Room component

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
    if (this.onUserLeft) this.onUserLeft(data.userId); // Notify Room component
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

  toggleMute() {
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled; // True if enabled, false if muted
    }
    return false;
  }

  toggleVideo() {
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled; // True if enabled, false if off
    }
    return false;
  }

  disconnect() {
    this.peerConnection.close();
    this.peerConnection = null;
    
    this.localStream.getTracks().forEach(track => track.stop());
    this.localStream = null;

    this.remoteStream.getTracks().forEach(track => track.stop());
    this.remoteStream = null;

    this.users.clear();
    this.roomId = null;
    this.remoteUserId = null;
  }
}