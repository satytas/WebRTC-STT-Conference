import numpy as np
from hmm import HMM
import phonemes as ph
from scipy.special import logsumexp 

def print_hmm_params(hmm_params_dict):
    np.set_printoptions(precision=3, suppress=True)
    print(f"\n=== HMM Parameters ===\n")
    print(f"Phonemes ({len(hmm_params_dict['phonemes'])}): {hmm_params_dict['phonemes']}")
    print(f"Number of States: {hmm_params_dict['num_states']}")
    print(f"MFCC Dimension: {hmm_params_dict['mfcc_dim']}\n")
    print("Initial Probabilities:")
    print(hmm_params_dict['initial_probs'])
    print()
    print("Transition Matrix (showing first 5x5 block):")
    print(hmm_params_dict['transition_matrix'][:5, :5])
    print()
    print("Emission Means (showing first 3 states):")
    print(hmm_params_dict['emission_means'][:3])
    print()
    print("Emission Covariances (showing first state's matrix):")
    print(hmm_params_dict['emission_covariances'][0])
    print()
    np.set_printoptions()

def setup_hmm(load_from_file=True):
    print("\n=== Initializing HMM Parameters ===")
    load_file = ph.PARAMS_FILE if load_from_file else None
    params = ph.init_hmm_params(load_file)
    if not params:
        print("HMM Parameters initialization failed.")
        return None, None
    print("\n=== Building HMM Model ===")
    try:
        hmm = HMM(params)
    except Exception as e:
        print(f"Error creating HMM instance: {e}")
        return None, params
    return hmm, params

def generate_dummy_sequences(num_sequences=10, avg_len=50, mfcc_dim=ph.MFCC_DIM):
    if num_sequences <= 0 or avg_len <= 0 or mfcc_dim <= 0: return []
    print(f"\n=== Generating {num_sequences} Dummy Observation Sequence(s) (Avg Len={avg_len}) ===")
    sequences = []
    for _ in range(num_sequences):
        T = max(5, int(np.random.normal(loc=avg_len, scale=avg_len / 4)))
        dummy_obs = np.random.rand(T, mfcc_dim) * 0.5
        sequences.append(dummy_obs)
    print(f"Generated {len(sequences)} sequence(s).")
    return sequences

def run_forward_test(hmm, observations):
    if hmm is None or observations is None or len(observations) == 0: return
    print("\n--- Testing Forward Algorithm ---")
    alpha = hmm._calculate_alpha(observations)
    if alpha is not None:
        log_prob_O = logsumexp(alpha[observations.shape[0] - 1, :])
        print(f"Forward Algo: Log Probability P(O|lambda): {log_prob_O:.2f}")
    else: print("Forward calculation failed.")

def run_backward_test(hmm, observations):
    if hmm is None or observations is None or len(observations) == 0: return
    print("\n--- Testing Backward Algorithm ---")
    beta = hmm._calculate_beta(observations)
    if beta is not None:
        print(f"Backward calculation completed. Beta table shape: {beta.shape}")
    else: print("Backward calculation failed.")

def run_viterbi_test(hmm, observations):
    if hmm is None or observations is None or len(observations) == 0: return
    print(f"\n--- Testing Viterbi Decoding ---")
    best_path, phoneme_sequence, final_log_prob = hmm.decode_to_phonemes(observations)
    print(f"Viterbi Algo: Final Log-Probability: {final_log_prob:.2f}")
    if best_path:
        print(f"Viterbi Algo: Decoded Phoneme Sequence ({len(best_path)} states): {phoneme_sequence}")
    else: print("Viterbi Algo: No valid path found.")

def run_training(hmm, training_sequences, max_iter=5, save_params=False, threshold=0.01):
    if hmm is None or not training_sequences:
        print("Cannot run training: HMM not initialized or no training data.")
        return

    print(f"\n--- Starting Baum-Welch Training ({max_iter} iterations, threshold={threshold}) ---")
    likelihood_history = hmm.baum_welch_train(training_sequences,
                                   max_iterations=max_iter,
                                   convergence_threshold=threshold)
    print("\n--- Training Complete ---")
    print(f"Log Likelihood History: {likelihood_history}")

    if save_params:
        print(f"Saving trained parameters to {ph.PARAMS_FILE}...")
        updated_params = {
            "phonemes": ph.PHONEMES, "num_states": hmm.N, "mfcc_dim": hmm.mfcc_dim,
            "state_map": hmm.states_map, "index_map": hmm.index_map,
            "initial_probs": np.exp(hmm.log_pi), "transition_matrix": np.exp(hmm.log_A),
            "emission_means": hmm.emission_means, "emission_covariances": hmm.emission_covariances
        }
        ph.save_array_params(ph.PARAMS_FILE, updated_params["initial_probs"],
                              updated_params["transition_matrix"], updated_params["emission_means"],
                              updated_params["emission_covariances"])
        print("--- Trained Parameters Saved ---")
    else:
        print("--- Trained Parameters NOT saved ---")


if __name__ == "__main__":
    hmm_instance, initial_params = setup_hmm(load_from_file=False)
    dummy_sequences = generate_dummy_sequences(num_sequences=10, avg_len=50)

    # print_hmm_params(initial_params)
    # run_forward_test(hmm_instance, dummy_sequences[0])
    # run_backward_test(hmm_instance, dummy_sequences[0])
    # run_viterbi_test(hmm_instance, dummy_sequences[0])
    # run_training(hmm_instance, dummy_sequences, max_iter=5, save_params=False)