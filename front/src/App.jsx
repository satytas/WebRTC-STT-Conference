import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SignalingProvider } from './context/SignalingContext.jsx';
import Landing from './pages/Landing.jsx';
import Room from './pages/Room.jsx';
import JoinRoom from './pages/JoinRoom.jsx';
import CreateRoom from './pages/CreateRoom.jsx';
import PasswordPrompt from './pages/PasswordPrompt.jsx';

//the url for passwordPrompt should look like this:
//       /password?room_id=${roomId}


function App() {
  return (
    <SignalingProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/join_room" element={<JoinRoom />} />
          <Route path="/create_room" element={<CreateRoom />} />
          <Route path="/room" element={<Room />} />
          <Route path="/password" element={<PasswordPrompt />} />
        </Routes>
      </BrowserRouter>
    </SignalingProvider>
  );
}

export default App;