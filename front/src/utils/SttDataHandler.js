export class SttDataHandler {
  constructor(audioTrack) {
      this.mediaStream = new MediaStream([audioTrack]);// live audio stream reference
      this.mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'; // Checks if the browser support webm, iff not switches to ogg
      this.setupRecorder();
  }

  setupRecorder() {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: this.mimeType });// records from the media stream and saves clises as blobs - chunks of binary data
      this.mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0) {
              await this.sendAudio(event.data);
          }
      };
      this.mediaRecorder.onstop = () => {
          this.startRecording(); // Restart recording for the next chunk
      };
  }

  init() {
      this.startRecording();
  }

  startRecording() {
      if (this.mediaRecorder.state !== 'recording') {
          this.mediaRecorder.start(1000);
          setTimeout(() => {
              if (this.mediaRecorder.state === 'recording') {
                  this.mediaRecorder.stop();
              }
          }, 1000);
      }
  }

  async sendAudio(blob) {
      const formData = new FormData();
      formData.append('audio_segment', blob, 'audio.webm'); // web aip construction key value pairs

      try {
          const response = await fetch('http://localhost:5000/get-audio', {
              method: 'POST',
              body: formData,
          });
          const result = await response.json();
          console.log("Server response:", result);
      } catch (err) {
          console.error("Error sending audio:", err);
      }
  }
}