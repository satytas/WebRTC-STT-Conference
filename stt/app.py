from flask import Flask, request, jsonify
from flask_cors import CORS
import processor as stt

app = Flask(__name__) # Initialize the flask server
    
CORS(app, origins=["http://localhost:5173"]) # Define the CORS

stt.load_hmm() # Uninitialize the hmm

@app.route('/get-audio', methods=['POST'])
def get_audio_data():
    try:
        # 1. Validate request
        if 'audio_segment' not in request.files:
            return jsonify({'error': 'No audio file'}), 400
        
        audio_file = request.files['audio_segment']

        # 2. Decode audio to frames
        audio_frames, sample_rate = stt.get_audio_frames(audio_file)

        if audio_frames is None:
            return jsonify({'error': 'Audio decoding failed'}), 500
        
        if not audio_frames:
            return jsonify({'message': 'No frames decoded', 'text': ''}), 200

        # 3. Convert frames to MFCCs
        mfccs = stt.audio_frames_to_mfccs(audio_frames, sample_rate)
        if mfccs is None:
            return jsonify({'message': 'MFCC extraction failed', 'text': ''}), 200

        # 4. Decode MFCCs and return text
        recognized_text = stt.decode_sequence(mfccs)

        return jsonify({'message': 'Audio processed successfully', 'text': recognized_text}), 200

    except Exception as e:
        app.logger.error(f"Exception /get-audio route: {e}", exc_info=True)
        return jsonify({'error': 'An unexpected server error occurred'}), 500

if __name__ == '__main__':
    if stt.hmm_model is None:
         print("\nHMM model failed initiailizing- Cant open the server\n")
         exit(1)
    else:
         print("\nStarting Flask development server...")
         app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)