from flask import Flask, request, jsonify
from flask_cors import CORS
import av # py wrapper for ffmgef to decode/encode media files
import io # lets you work with bytes as if they were written in a file on the memory like creating files - avoiding disk saves
import scipy.io.wavfile as wavfile # writes wav into numpy arrs
import numpy as np
import os
import time

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])

file_counter = 0

@app.route('/get-audio', methods=['POST'])
def get_data():
    global file_counter
    if 'audio_segment' not in request.files:
        return jsonify({'error': 'No audio provided'}), 400

    audio_file = request.files['audio_segment'] #  takes the file onj from post
    webm_data = audio_file.read() # returns the file's binary data as bytes

    try:
        # Open WebM file in memory
        container = av.open(io.BytesIO(webm_data), format='webm') # creates container obj in mem from the webm file with webm format and the data from the file
        stream = container.streams.audio[0] # webm has couple of streams - audio, video
        sample_rate = stream.rate  # Get actual sample rate - how much time the audio measured per second, numer of samples captured per second - the more the better quality and bigger size, for speach 16-8kHz should be good

        # Decode audio frames
        audio_data = []
        #container.decode(stream) - reads the audio stream and yields frames abt 20ms each
        for frame in container.decode(stream):
            samples = frame.to_ndarray() #converts to np arr
            audio_data.append(samples)
        container.close()

        if not audio_data:
            return jsonify({'error': 'No audio data decoded'}), 400

        # Combine frames and convert to mono (audio with one channel) if needed - might record in stero - 2 audio channels
        audio_data = np.concatenate(audio_data, axis=1) # joins the frame arrs along the time axis
        if audio_data.ndim > 1: # checks if one or more audio channels
            audio_data = audio_data.mean(axis=0) # avg the channels to create one mono audio 

        # MIGHT NOT NEED - work with floats
        # Scale to 16-bit PMC - way to store audio, each sample is 16-it int (from -32768 to 32767)
        # (audio_data * 32767) - scales flotation point samples to 16 bit integers, clip(-32768, 32767) - make sure values stay in 16 bit range, astype converts to 16 bit
        audio_data = (audio_data * 32767).clip(-32768, 32767).astype(np.int16) 

        # Write WAV file
        wav_io = io.BytesIO() # creates memory buffer
        wavfile.write(wav_io, sample_rate, audio_data) # builds wav file on the buffer
        wav_data = wav_io.getvalue() # grabs the finished binary data as bytes

        # Save WAV file
        file_path = os.path.join(os.getcwd(), 'stt', 'tmp')
        os.makedirs(file_path, exist_ok=True)
        wav_filename = f"temp_audio_{file_counter}.wav"
        file_counter += 1
        with open(os.path.join(file_path, wav_filename), 'wb') as f:
            f.write(wav_data)

        return jsonify({'message': 'Audio processed successfully'})

    except Exception as e:
        return jsonify({'error': 'Failed to process audio'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)