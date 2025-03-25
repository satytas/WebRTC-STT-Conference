import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSignaling } from '../context/SignalingContext';

function PasswordPrompt() {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const signalingClient = useSignaling();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room_id');

  const handleJoin = async () => {
    if (!password) {
      alert('Please enter a password');
      return;
    }

    try {
      console.log(`Validating password for roomId: ${roomId}, password: "${password}"`);
      const result = await signalingClient.validatePassword(roomId, password);

      if (result.success) {
        navigate(`/room?room_id=${roomId}`);
      } else {
        alert('Invalid password');
        setPassword('');
      }
    } catch (err) {
      console.error(err);
      alert('Error validating password');
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div id="passwordPrompt">
      <h1>Room "{roomId}" Requires a Password</h1>
      
      <input
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="button-container">
        <button onClick={handleJoin}>Join</button>
        <button onClick={handleBack}>Back</button>
      </div>
    </div>
  );
}

export default PasswordPrompt;