import av              # python wrapper for FFmpegto decode/encode media
import io              # for in-memory byte streams like files
import numpy as np
import librosa         # audio analysis for MFCCs
from hmm import HMM
import phonemes as ph

hmm_model = None

def load_hmm():
    global hmm_model

    ph.HMM_PARAMS = ph.init_hmm_params(ph.PARAMS_FILE)
    if ph.HMM_PARAMS:
        try:
            hmm_model = HMM(ph.HMM_PARAMS)
            print("STT: HMM model loaded/initialized.")
        except Exception as e:
            hmm_model = None
            print(f"STT ERROR: HMM instantiation failed: {e}")
    else:
        hmm_model = None
        print("STT ERROR: HMM Parameter init failed.")

def get_audio_frames(audio_file):
    try:
        webm_data = audio_file.read() # Read all binary data from the uploaded file
        # Open the webm data - that in mem
        container = av.open(io.BytesIO(webm_data), format='webm')

        if not container.streams.audio:
            return None, None

        # Get the first available audio stream from the container
        stream = container.streams.audio[0]
        sample_rate = stream.rate

        # yields small frames of raw audio samples as np arrs
        audio_frames = [frame.to_ndarray() for frame in container.decode(stream)]
        container.close()

        if not audio_frames:
            return [], sample_rate
        
        return audio_frames, sample_rate
    
    except Exception as e:
        print(f"STT ERROR: Audio decoding failed: {e}")
        return None, None

def audio_frames_to_mfccs(audio_frames, sample_rate):
    # Takes list of decoded frames and prepares them for hmm

    if not audio_frames or sample_rate is None:
        return None

    # Stitch Frames
    try:
        # Determine audio structure- mono or planar- from first frame's shape
        first_frame = audio_frames[0]
        if first_frame.ndim == 1:
            # If 1D then it's alr mono so concatenate frames along axis0
            audio_data = np.concatenate(audio_frames, axis=0)
        elif first_frame.shape[0] < first_frame.shape[1]:
            # If 2D, rows < columns then proly planar - channels=rows so concatenate along samples in axis1
            audio_data = np.concatenate(audio_frames, axis=1)
        else:
            # Same as before just the channels on cols
            audio_data = np.concatenate(audio_frames, axis=0)

        # Convert to Mono
        if audio_data.ndim > 1: # Check if still multi-channel
            # avg sample values from the channel axis to mix down to mono
            channel_axis = None
            if audio_data.shape[0] < audio_data.shape[1]:
                channel_axis = 0
            else:
                channel_axis = 1
            audio_data = np.mean(audio_data, axis=channel_axis)

        # Ensure Float32 & Normalize
        # normalization makes volume consistent - not source related in range- [-1.0, 1.0] of floats
        if np.issubdtype(audio_data.dtype, np.integer): # Check if data is integer type (like int16)
            # Find max val for the int type
            max_val = np.iinfo(audio_data.dtype).max if np.iinfo(audio_data.dtype).max > 0 else 32767.0
            # Convert to float32 and divide by max_val to normalize
            audio_data = audio_data.astype(np.float32) / max_val

        elif not np.issubdtype(audio_data.dtype, np.floating):
            audio_data = audio_data.astype(np.float32)

        if audio_data.dtype != np.float32:
             audio_data = audio_data.astype(np.float32)

    except Exception as e:
        print(f"STT ERROR during audio prep: {e}")
        return None

    # Extract MFCCs
    if hmm_model is None: print("STT ERROR: HMM not init for MFCC."); return None
    try:
        # y-> input audio- 1D float32 array, sr-> sample rate
        # n_mfcc = num of coefficients to return
        mfccs = librosa.feature.mfcc(y=audio_data,
                                     sr=sample_rate,
                                     n_mfcc=hmm_model.mfcc_dim).T # the hmm input is the opposite
        
        if mfccs.shape[0] == 0:
            print("STT WARNING: 0 MFCC frames extracted.")
            return None
        
        return mfccs
    
    except Exception as e:
        print(f"STT ERROR during MFCC extraction: {e}")
        return None

def decode_sequence(mfccs):
    if hmm_model is None: return "[HMM Init Error]"

    if not isinstance(mfccs, np.ndarray) or mfccs.ndim != 2 or mfccs.shape[0] == 0:
        return ""
    
    if mfccs.shape[1] != hmm_model.mfcc_dim:
        return "[MFCC Dim Error]"

    try:

        path_indices, _ = hmm_model.viterbi_decode(mfccs)

        # Convert the sequence of states back to phonemes
        phoneme_list = [hmm_model.index_map[idx] for idx in path_indices]

        # Post-process raw phoneme sequence
        recognized_text = ""
        if phoneme_list:
            # Remove same phoneme sequences
            processed = [p for i, p in enumerate(phoneme_list) if i == 0 or p != phoneme_list[i-1]]
            
            # Remove silence tokens
            final = [p for p in processed if p != 'SIL']

            recognized_text = " ".join(final)
        return recognized_text
    except Exception as e:
        # Catch any errors during the Viterbi decoding process
        print(f"STT Error during Viterbi decode: {e}")
        return "[Decoding Error]"