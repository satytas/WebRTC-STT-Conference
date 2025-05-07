export class SttDataHandler {
    constructor(audioTrack, recordLen) {
        this.recordLen = recordLen
        this.totalRecordingsNum = 0
        this.mediaStream = new MediaStream([audioTrack]);// live audio stream reference
        this.mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'; // Checks if the browser support webm, iff not switches to ogg
        this.setupRecorder();
    }

    setupRecorder() {
        this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: this.mimeType });// records from the media stream and saves clises as blobs - chunks of binary data
        this.mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                await this.sendAudio({
                    data: event.data,
                    startTime: this.currentStartRecordTime
                });
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
        this.currentStartRecordTime = Date.now();

        if (this.mediaRecorder.state !== 'recording') {
            this.mediaRecorder.start(this.recordLen);
            setTimeout(() => {
                if (this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
            }, this.recordLen);
        }
    }

    async sendAudio(event) {
        const {data, startTime} = event;

        const formData = new FormData();
        formData.append('audio_segment', data, 'audio.webm');

        try {
            const startProcessTime = Date.now();

            const response = await fetch('http://localhost:5000/get-audio', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            const endTime = Date.now();

            const toMMSS = ms => {
                const date = new Date(ms);
                const mins = date.getMinutes().toString().padStart(2, '0');
                const secs = (date.getSeconds() + date.getMilliseconds() / 1000).toFixed(2).padStart(5, '0');
                return `${mins}:${secs}`;
            };
            const delay = ((endTime - startTime) / 1000).toFixed(2);
            console.log(`Start: ${toMMSS(startTime)} | End: ${toMMSS(endTime)} | total delay: ${delay}`);
            console.log("Server response:", result);
        } catch (err) {
            console.error("Error sending audio:", err);
        }
    }
}