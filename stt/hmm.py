import numpy as np
import phonemes as ph
from scipy.stats import multivariate_normal

epsilon = 1e-10
LOG_ZERO = -np.inf # for paths transitions that not possible

class HMM:
    def __init__(self, params):
        self.N = params["num_states"]
        self.mfcc_dim = params["mfcc_dim"]
        self.states_map = params["state_map"]
        self.index_map = params["index_map"]

        # Storing the params in longs for to avoid underflow when mul small values
        self.log_pi = np.log(params["initial_probs"] + epsilon)
        self.log_A = np.log(params["transition_matrix"] + epsilon)

        # Building emission model objects for each state
        self.emission_models = []
        for i in range(self.N):
            mean_i = params["emission_means"][i]
            cov_i = params["emission_covariances"][i]

            model_i = multivariate_normal(mean=mean_i, cov=cov_i, allow_singular=True) # add check for singular matrixes cuz it can be computed
            self.emission_models.append(model_i)

        print(f"Initialized HMM with {len(self.emission_models)} emission models")
    
    def _log_emission_prob(self, observation_vector, state_index):
        try:
            log_pdf = self.emission_models[state_index].logpdf(observation_vector)
            if not np.isfinite(log_pdf):
                return LOG_ZERO
            return log_pdf
        except Exception as e:
            return LOG_ZERO

    def viterbi_decode(self, observations):
        T = observations.shape[0]
        if T == 0:
            return [], LOG_ZERO # return if there are no observations

        N = self.N


        # 1. create arrays to store the found paths data
        # 2d array to store the paths probability values
        paths_probs = np.full((T, N), LOG_ZERO)
        # 2d array to store the last state indexes that transitioning to current state
        paths_backpointers = np.zeros((T, N), dtype=int)


        # 2. Initialize step - first start probabilities for each state
        for j in range(N):
            log_B_j_O0 = self._log_emission_prob(observations[0], j)
            if log_B_j_O0 > LOG_ZERO: # only if possible
                paths_probs[0, j] = self.log_pi[j] + log_B_j_O0


        # 3. Inductive step from t1 to T-1
        for t in range(1, T):
            for j in range(N):
                log_B_j_Ot = self._log_emission_prob(observations[t], j)

                # If the obs at time t at state j not possible then the path P 0
                if log_B_j_Ot <= LOG_ZERO:
                    continue

                # calc all state transitions from this state and time and all states from last time that are end of a path
                prev_paths_probs = paths_probs[t-1, :] + self.log_A[:, j] # log prob calc

                # Find the highest P from all possible paths
                best_path_prob = np.max(prev_paths_probs)
                # get the state of the best path
                best_prev_state = np.argmax(prev_paths_probs)

                # Update the paths data
                if best_path_prob > LOG_ZERO:
                    paths_probs[t, j] = best_path_prob + log_B_j_Ot
                    paths_backpointers[t, j] = best_prev_state
                # if we didnt find valid path- stays 0


        # 4. Termination step
        # after finding all final paths, find the one with the highest probability
        max_final_log_prob = np.max(paths_probs[T - 1, :])

        # If all paths have zero probability sequence is impossible
        if max_final_log_prob <= LOG_ZERO:
            return [], LOG_ZERO

        # get the last state of the best path
        last_state = np.argmax(paths_probs[T - 1, :])


        # 5. Backtracking
        # Start building the path from the last state
        best_path = [last_state]

        # Loop in reverse from the state before last one from T-1 to t1
        for t in range(T - 1, 0, -1):
            prev_state = paths_backpointers[t, last_state]
            best_path.insert(0, prev_state)
            last_state = prev_state

        return best_path, max_final_log_prob


if __name__ == "__main__":
    print("\n=== Initializing HMM Parameters ===")
    ph.HMM_PARAMS = ph.init_hmm_params()

    if ph.HMM_PARAMS:
        ph.print_hmm_params(ph.HMM_PARAMS)

        print("\n=== Building HMM Model ===")
        hmm_model = HMM(ph.HMM_PARAMS)
        assert len(hmm_model.emission_models) == hmm_model.N

        print("\n=== Testing Viterbi Decoding ===")
        T_test = 25
        dummy_obs = np.random.rand(T_test, hmm_model.mfcc_dim) * 0.5  # small random data scale

        print(f"Generating {T_test} dummy MFCC observations...")
        print("Starting Viterbi decoding...")
        
        best_path, final_log_prob = hmm_model.viterbi_decode(dummy_obs)

        print("Finished Viterbi decoding.\n")
        print(f"Final Log-Probability: {final_log_prob:.2f}")
        print(f"Best Path Length: {len(best_path)} states")

        if best_path:
            phoneme_sequence = [hmm_model.index_map[idx] for idx in best_path]
            print(f"\nDecoded Phoneme Sequence:\n{' -> '.join(phoneme_sequence)}")
        else:
            print("No valid path found.")

    else:
        print("\nHMM Parameters initialization failed.")