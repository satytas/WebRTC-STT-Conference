import numpy as np

PARAMS_FILE = "phonems_arrays.npz" 


PHONEMES = [
    'SIL',  # Silence / Background Noise
    'HH',   # (h)i, (h)ello
    'AY',   # h(i), b(ye)
    'EH',   # h(e)llo, y(e)s
    'L',    # he(ll)o
    'OW',   # hell(o), n(o)
    'Y',    # (y)es
    'S',    # ye(s)
    'N',    # (n)o
    'B',    # (b)ye, (b)ad
    'AE',   # b(a)d
    'D',    # ba(d), goo(d)
    'G',    # (g)ood
    'UH'    # g(oo)d
]

NUM_STATES = len(PHONEMES)

MFCC_DIM = 13  # Observation vector dimension

STATE_MAP = {phoneme: i for i, phoneme in enumerate(PHONEMES)} # access states as indexes

INDEX_MAP = {i: phoneme for i, phoneme in enumerate(PHONEMES)} # access states as strings

INITIAL_PROBS = np.zeros(NUM_STATES)

TRANSITION_MATRIX = np.zeros((NUM_STATES, NUM_STATES))

EMISION_MEANS = np.zeros((NUM_STATES, MFCC_DIM))

EMISION_CONVARIOANCES = np.zeros((NUM_STATES, MFCC_DIM, MFCC_DIM))

HMM_PARAMS = {
    "phonemes": PHONEMES,
    "num_states": NUM_STATES,
    "mfcc_dim": MFCC_DIM,
    "state_map": STATE_MAP,
    "index_map": INDEX_MAP,
    "initial_probs": INITIAL_PROBS,
    "transition_matrix": TRANSITION_MATRIX,
    "emission_means": EMISION_MEANS,
    "emission_covariances": EMISION_CONVARIOANCES,
}

def _gen_initial_probs(num_states, state_map):
    initial_probs = np.zeros(num_states)
    if 'SIL' in state_map:
        # High probability to start with silence
        silence_index = state_map['SIL']
        initial_probs[silence_index] = 0.8
        # Distribute remaining probability to rest of the states
        other_prob = (1.0 - initial_probs[silence_index]) / (num_states - 1) if num_states > 1 else 0
        for i in range(num_states):
            if i != silence_index:
                initial_probs[i] = other_prob
    else:
        initial_probs.fill(1.0 / num_states)

    # Makes sure sums up to 1
    initial_probs /= initial_probs.sum()
    return initial_probs

def _gen_transition_matrix(num_states):
    transition_matrix = np.zeros((num_states, num_states))
    # High probability of staying in same state
    diagonal_prob = 0.7
    # Distribute remaining probability for rest of states
    other_prob = (1.0 - diagonal_prob) / (num_states - 1) if num_states > 1 else 0

    for i in range(num_states):
        for j in range(num_states):
            if i == j:
                transition_matrix[i, j] = diagonal_prob
            else:
                transition_matrix[i, j] = other_prob

    # Make sure rows sum to 1
    row_sums = transition_matrix.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1 # To not divide by zero
    transition_matrix /= row_sums
    return transition_matrix

def _gen_emission_params(num_states, mfcc_dim):
    # fills array with normal distribution vals- mean 0 & std dev 1
    emission_means = np.random.randn(num_states, mfcc_dim) * 0.1
    # creates the covariance for each state - the Identity - the variance
    emission_covariances = np.array([np.identity(mfcc_dim) for _ in range(num_states)])
    return emission_means, emission_covariances

def save_array_params(filepath, initial_p, transition_m, emission_m, emission_c):
    try:
        np.savez(filepath,
                 initial_probs=initial_p,
                 transition_matrix=transition_m,
                 emission_means=emission_m,
                 emission_covariances=emission_c)
        print(f"parameters saved to {filepath}")
    except Exception as e:
        print(f"Error saving parameters to {filepath}: {e}")

def load_array_params(filepath):
    try:
        data = np.load(filepath)

        required_keys = ["initial_probs", "transition_matrix", "emission_means", "emission_covariances"]
        if not all(k in data for k in required_keys):
            data.close()
            raise ValueError(f"missing required HMM parameter keys.")

        initial_p = data['initial_probs']
        transition_m = data['transition_matrix']
        emission_m = data['emission_means']
        emission_c = data['emission_covariances']
        data.close()

        print(f"parameters loaded successfully from {filepath}")
        return (initial_p, transition_m, emission_m, emission_c)

    except FileNotFoundError:
        # Don't print error if file just doesn't exist yet
        return None
    except Exception as e:
        print(f"Error loading parameters from {filepath}: {e}")
        return None

def init_hmm_params(filepath=None):
    loaded_array_data = None
    generate_defaults = True

    if filepath:
        print(f"Attempting to load parameters from {filepath}...")
        loaded_array_data = load_array_params(filepath)

        if loaded_array_data:
            # Check that dimensions match
            initial_p, transition_m, emission_m, emission_c = loaded_array_data
            valid = True

            if initial_p.shape != (NUM_STATES,): valid = False; print("Mismatch: initial_probs shape")
            if transition_m.shape != (NUM_STATES, NUM_STATES): valid = False; print("Mismatch: transition_matrix shape")
            if emission_m.shape != (NUM_STATES, MFCC_DIM): valid = False; print("Mismatch: emission_means shape")
            if emission_c.shape != (NUM_STATES, MFCC_DIM, MFCC_DIM): valid = False; print("Mismatch: emission_covariances shape")

            if valid:
                print("Using loaded parameters.") # Message for successful load
                generate_defaults = False
            else:
                print("Dimension mismatch. Will generate defaults.")

    if generate_defaults:
        print("Generating default parameters...")
        try:
            initial_p = _gen_initial_probs(NUM_STATES, STATE_MAP)
            transition_m = _gen_transition_matrix(NUM_STATES)
            emission_m, emission_c = _gen_emission_params(NUM_STATES, MFCC_DIM)
            print("Default parameters generated.")

            if filepath:
                 save_array_params(filepath, initial_p, transition_m, emission_m, emission_c)

        except Exception as e:
            print(f"Error generating default parameters: {e}")
            return None

    else:
        initial_p, transition_m, emission_m, emission_c = loaded_array_data
        print("Parameter source: Loaded from file.")

    INITIAL_PROBS = initial_p
    TRANSITION_MATRIX = transition_m
    EMISION_MEANS = emission_m
    EMISION_CONVARIOANCES = emission_c
    
    final_params = {
        "phonemes": PHONEMES,
        "num_states": NUM_STATES,
        "mfcc_dim": MFCC_DIM,
        "state_map": STATE_MAP,
        "index_map": INDEX_MAP,
        "initial_probs": INITIAL_PROBS,
        "transition_matrix": TRANSITION_MATRIX,
        "emission_means": EMISION_MEANS,
        "emission_covariances": EMISION_CONVARIOANCES,
    }
    return final_params

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

if __name__ == "__main__":
    HMM_PARAMS = init_hmm_params(PARAMS_FILE)
    print_hmm_params(HMM_PARAMS)