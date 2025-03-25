import { useNavigate } from 'react-router-dom';

function Landing() {
    const navigate = useNavigate();

    const handleJoinBtn = () => navigate('/join_room');
    const handleCreateBtn = () => navigate('/create_room');

    return (
        <div id="landing">
            <h1 id="titleLbl">Welcome to Saty's.. Saty's smth.. hm...</h1>
            
            <div className="button-container">
                <button onClick={handleJoinBtn}>Join With Code</button>
                <button onClick={handleCreateBtn}>Create Room</button>
            </div>
        </div>
    );
} export default Landing;