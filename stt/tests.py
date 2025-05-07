import numpy as np
from hmm import HMM
import phonemes as ph
from scipy.special import logsumexp

def print_hmm_params(hmm_params):
    np.set_printoptions(precision=3, suppress=True)
    print("\n=== HMM Parameters ===\n")
    
    print(f"Phonemes ({len(hmm_params['phonemes'])}): {hmm_params['phonemes']}")
    print(f"Number of States: {hmm_params['num_states']}")
    print(f"MFCC Dimension: {hmm_params['mfcc_dim']}\n")

    print("Initial Probabilities:")
    print(hmm_params['initial_probs'])
    print()

    print("Transition Matrix (showing first 5x5 block):")
    print(hmm_params['transition_matrix'][:5, :5])
    print()

    print("Emission Means (showing first 3 rows):")
    print(hmm_params['emission_means'][:3])
    print()

    print("Emission Covariances (showing first covariance matrix):")
    print(hmm_params['emission_covariances'][0])
    print()

    np.set_printoptions() 

def setup_hmm(load_from_file=True):
    print("\n=== Initializing HMM Parameters ===")
    
    load_file = None
    if load_from_file:
        load_file = ph.PARAMS_FILE
    
    params = ph.init_hmm_params(load_file)

    if not params:
        print("HMM Parameters initialization failed.")

    print("\n=== Building HMM Model ===")
    try:
        hmm = HMM(params)
    except Exception as e:
        print(f"Error creating HMM instance: {e}")

    return hmm, params

def gen_dummy_obs(mfcc_dim, frames_num):
    print(f"\n=== Generating Dummy Observations (T={frames_num}) ===")
    dummy_obs = np.random.rand(frames_num, mfcc_dim) * 0.5
    print(f"Observations shape: {dummy_obs.shape}")

    return dummy_obs

# --- Individual Tests ---
def run_forward_test(hmm, observations):
    if hmm is None or observations is None:
        return
    
    print("\n--- Testing Forward Algorithm ---")
    alpha = hmm.create_forward_table(observations)
    if alpha is not None:
        print("Forward calculation completed.")
        print(f"Alpha table shape: {alpha.shape}")

        # Calculate total log prob P(O|lambda) using final row of alpha
        log_prob_O = logsumexp(alpha[observations.shape[0] - 1, :])

        print(f"Forward Algo: Log Probability P(O|lambda): {log_prob_O:.2f}")
        #print("Alpha table (first 5x5):\n", alpha[:5, :5])
    else:
        print("Forward calculation failed.")

def run_backward_test(hmm, observations):
    if hmm is None or observations is None:
        return
    
    print("\n--- Testing Backward Algorithm ---")
    beta = hmm.create_backward_table(observations)
    if beta is not None:
        print("Backward calculation completed.")
        print(f"Beta table shape: {beta.shape}")
        print("Beta table (first 5x5):\n", beta[:5, :5]) # Optional detail
    else:
        print("Backward calculation failed.")

def run_viterbi_test(hmm, observations):
    if hmm is None or observations is None:
        return
    
    print("\n--- Testing Viterbi Decoding ---")
    # Using decode_to_phonemes for convenience
    best_path, phoneme_sequence, final_log_prob = hmm.decode_to_phonemes(observations)

    print("Finished Viterbi decoding.")
    print(f"Viterbi Algo: Final Log-Probability: {final_log_prob:.2f}")
    print(f"Best Path Length: {len(best_path)} states")

    if phoneme_sequence:
        print(f"Viterbi Algo: Decoded Phoneme Sequence: {phoneme_sequence}")
    else:
        print("Viterbi Algo: No valid path found.")

# --- Main Execution Block for Tests ---
if __name__ == "__main__":
    hmm_instance, params = setup_hmm(load_from_file=False)
    dummy_observations = gen_dummy_obs(hmm_instance.mfcc_dim, 25)

    #print_hmm_params(params)

    if hmm_instance and dummy_observations is not None:
        #run_forward_test(hmm_instance, dummy_observations)
        #run_backward_test(hmm_instance, dummy_observations)
        run_viterbi_test(hmm_instance, dummy_observations)
        pass
    else:
        print("\nSetup failed. Cannot run tests.")