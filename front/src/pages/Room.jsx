import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WebRTCClient } from '../utils/WebRTCClient';
import { useSignaling } from '../context/SignalingContext';

function Room() {
  const [searchParams] = useSearchParams();
  const signalingClient = useSignaling();
  const userId = sessionStorage.getItem('userId');
  const roomId = searchParams.get('room_id') || 'test-room';

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const webRTCClientRef = useRef(null);
  const [remoteUserId, setRemoteUserId] = useState(null); // State for remote user ID
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    console.log("creating WebRTCClient");
    webRTCClientRef.current = new WebRTCClient(
      signalingClient,
      (userId) => setRemoteUserId(userId), // onNewUser callback
      () => setRemoteUserId(null) // onUserLeft callback
    );
    console.log("created WebRTCClient");

    async function init() {
      await webRTCClientRef.current.initialize();
      webRTCClientRef.current.setHandlers(); // Set handlers after peerConnection exists
      await signalingClient.enterRoom(roomId);
      localVideoRef.current.srcObject = webRTCClientRef.current.localStream;
      remoteVideoRef.current.srcObject = webRTCClientRef.current.remoteStream;

      const audioTrack = webRTCClientRef.current.localStream.getAudioTracks()[0];
      const videoTrack = webRTCClientRef.current.localStream.getVideoTracks()[0];
      setIsMuted(!audioTrack.enabled);
      setIsVideoOff(!videoTrack.enabled);
    }

    init();

    return () => {
      webRTCClientRef.current.disconnect();
      signalingClient.disconnect();
    };
  }, [roomId, signalingClient]);

  // Update remote video when remoteStream changes
  useEffect(() => {
    if (webRTCClientRef.current && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = webRTCClientRef.current.remoteStream;
    }
  }, [webRTCClientRef.current?.remoteStream]);

  const copyIdBtn = () => {
    const roomIdText = document.getElementById('roomIdDisplay').textContent;
    navigator.clipboard.writeText(roomIdText).then(() => alert('Room ID copied to clipboard!'));
  };

  const inviteBtn = () => {
    const url = window.location.href;
    const choice = confirm('Would you like to send via email instead?');
    if (choice) {
      const subject = encodeURIComponent('Join pls!');
      const body = encodeURIComponent(`Hey! ermm actually would u consider to join me?! <3: ${url}`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Room URL copied to clipboard!'));
    }
  };

  const toggleAudioBtn = () => {
    const audioEnabled = webRTCClientRef.current.toggleMute();
    setIsMuted(!audioEnabled);
  };

  const toggleVideoBtn = () => {
    const videoEnabled = webRTCClientRef.current.toggleVideo();
    setIsVideoOff(!videoEnabled);
  };

  return (
    <div id="room">
      <h1>Room</h1>
      <div className="room-header">
        <div className="room-info">
          <div className="info-item">
            <span className="info-label">Room ID:</span>
            <span id="roomIdDisplay">{roomId}</span>
            <button onClick={copyIdBtn} id="copyRoomIdBtn" className="icon-button" title="Copy Room ID">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          <div className="info-item">
            <span className="info-label">Participants:</span>
            <span id="participantCount">1/2</span>
          </div>
        </div>
      </div>
      <div id="videos">
        <div className="video-container">
          <video className="video-player" ref={localVideoRef} autoPlay playsInline muted></video>
          <div className="video-label">You (<span id="localUserId">{userId}</span>)</div>
          <div className="video-status local-status">
            <span id="localAudioStatus" className={`status-indicator ${isMuted ? 'muted' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </span>
            <span id="localVideoStatus" className={`status-indicator ${isVideoOff ? 'video-off' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
            </span>
          </div>
        </div>
        <div className="video-container">
          <video className="video-player" ref={remoteVideoRef} autoPlay playsInline></video>
          <div className="video-label">Participant (<span id="remoteUserId">{remoteUserId || 'waiting...'}</span>)</div>
          <div className="video-status remote-status">
            <span id="remoteAudioStatus" className="status-indicator">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </span>
            <span id="remoteVideoStatus" className="status-indicator">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
            </span>
          </div>
        </div>
      </div>
      <div className="room-controls">
        <button id="muteBtn" className={`control-button ${isMuted ? 'active' : ''}`} onClick={toggleAudioBtn}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
          <span id="muteButtonText">{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>
        <button id="videoBtn" className={`control-button ${isVideoOff ? 'active' : ''}`} onClick={toggleVideoBtn}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          <span id="videoButtonText">{isVideoOff ? 'Video On' : 'Video Off'}</span>
        </button>
        <button id="inviteBtn" onClick={inviteBtn} className="control-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
          <span>Invite</span>
        </button>
        <button id="leaveRoomBtn" className="control-button danger" onClick={() => window.location.href = '/'}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Leave</span>
        </button>
      </div>
    </div>
  );
}

export default Room;