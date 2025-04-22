import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WebRTCClient } from '../utils/WebRTCClient';
import { useSignaling } from '../context/SignalingContext';

function CreateRoom() {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const signalingClient = useSignaling();

  const handleCreate = async () => {
    try {
      const result = await signalingClient.createRoom(password || null);
      console.log('Password- ', password);
      const roomId = result.roomId;

      const webRTCClient = new WebRTCClient(signalingClient);
      await webRTCClient.initialize();
      await signalingClient.enterRoom(roomId);

      navigate(`/room?room_id=${roomId}`);
    } catch (err) {
      console.error(err);
      alert('Error creating room');
    }
  };

  const handleBack = () => navigate('/');

  return (
    <div id="createPrompt">
        <h1>Create Room</h1>

        <input
            type="text"
            id="createPasswordInput"
            placeholder="Enter Password (leave empty for no password)"
            onChange={(e) => setPassword(e.target.value)}/>
        
        <div className="button-container">
            <button onClick={handleCreate}>Create Room</button>
            <button onClick={handleBack}>Back</button>
        </div>
    </div>
  );
}

export default CreateRoom;