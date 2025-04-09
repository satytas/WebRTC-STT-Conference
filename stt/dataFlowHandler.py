from flask import Flask, request, jsonify
import logging
from flask_cors import CORS
import os
import time

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])


@app.route('/get-audio', methods=['POST'])
def get_data():
    if 'audio_segment' not in request.files:
        return jsonify({'E' : 'no audio was gived'}), 400

    file_path = os.path.join(os.getcwd(), 'stt', 'tmp')

    audio_file = request.files['audio_segment']
    audio_file.save(os.path.join(file_path, f"temp_audio_{int(time.time())}.webm"))

    return jsonify({'M' : 'audio segment received'})

if __name__ == '__main__':
    logger = logging.getLogger('werkzeug')
    #logger.setLevel(logging.ERROR)

    app.run(host='0.0.0.0', port=5000, debug=True)