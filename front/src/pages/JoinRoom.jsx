import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSignaling } from "../context/SignalingContext";

function JoinRoom(){
    const [roomId, setRoomId] = useState("");
    const navigate = useNavigate();
    
    const signalingClient = useSignaling();

    const handleJoinRoomBtn = async () => {
        if(!roomId){
            alert("Please enter a room ID");
            return;
        }

        try{
            const result = await signalingClient.validateRoom(roomId);

            if(result.exist === false)
                alert("Room not found");

            else if(result.passwordRequired === false){
                console.log("result.passwordRequired: ", result.passwordRequired);
                await signalingClient.enterRoom(roomId);
                navigate(`/room?room_id=${roomId}`);
            }
            
            else if(result.passwordRequired === true)
                navigate(`/password?room_id=${roomId}`);
            
        }
        catch(error){
            console.error("Error joining room:", error);
            alert("Failed to join room. Please try again.");
        }
    }

    const handleBackBtn = () => {
        navigate("/");
    }

    return (
        <div id="joinPrompt">
            <h1>Join Room</h1>

            <input
                type="text"
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
            />

            <div className="button-container">
                <button onClick={handleJoinRoomBtn}>Join Room</button>
                <button onClick={handleBackBtn}>Back</button>
            </div>
            
        </div>
    );
}

export default JoinRoom;
