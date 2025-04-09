export class SttDataHandler {
    constructor(audioTrack) {
        const mediaStream = new MediaStream([audioTrack]);
        this.mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
        
        console.log("mediaRecorder: ", this.mediaRecorder);
    }

    init() {
        this.mediaRecorder.start(5000);
        console.log("Recording started");
        
        this.mediaRecorder.ondataavailable = async (event) => {
            console.log("Data available: ", event.data);

            await this.sendAudio(event.data);
            console.log("Audio sent");
        };

        this.mediaRecorder.onstop = () => {
            console.log("Recording stopped");
        };
    }

    async sendAudio (blob) {
        const formData = new FormData();
        formData.append('audio_segment', blob);
    
        try {
          const response = await fetch('http://localhost:5000/get-audio', {
            method: "POST",
            body: formData
          });

          const result = await response.json();
          console.log(result)
        }
        catch (err) {
          console.error('Error sending audio to server:', err);
        }
    }
}