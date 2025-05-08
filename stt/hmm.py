import numpy as np
import phonemes as ph
from scipy.stats import multivariate_normal
from scipy.special import logsumexp

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

    def _calculate_alpha(self, observations):
        T = observations.shape[0]
        if T == 0:
            return None # return if no observations

        N = self.N


        # 1. Create the alpha table
        alpha_table = np.full((T, N), LOG_ZERO) # fill with log_zero for 0 prob


        # 2. Initialization - the likelihood for all states at t=0
        for j in range(N):
            log_B_j_O0 = self._log_emission_prob(observations[0], j)
            if log_B_j_O0 > LOG_ZERO:
                alpha_table[0, j] = self.log_pi[j] + log_B_j_O0


        # 3. Induction from t1 to T-1
        for t in range(1, T): # For each subsequent time step
            for j in range(N): # For each current state j
                log_B_j_Ot = self._log_emission_prob(observations[t], j)

                if log_B_j_Ot > LOG_ZERO: # Only if emission is possible for this state
                    # Calculate for all N states, the P of transitioning to j & the P of them being the state in qt-1 given the obs sequence
                    log_prev_alpha_transitions = alpha_table[t-1, :] + self.log_A[:, j]

                    # Sum all posable prev alpha transitions to j to get the general prob of qt = j
                    log_sum_from_prev = logsumexp(log_prev_alpha_transitions)

                    # Add the emission prob for j given prev obs and update the alpha table 
                    alpha_table[t, j] = log_sum_from_prev + log_B_j_Ot
                # Else: alpha_table[t, j] remains LOG_ZERO

        return alpha_table # Return the completed alpha table

    def _calculate_beta(self, observations):
        T = observations.shape[0]
        if T == 0:
            return None

        N = self.N


        # 1. Create beta table
        beta_table = np.full((T, N), LOG_ZERO) # fill with log_zero for 0 prob


        # 2. Initialization - the likelihood for all states at t=T-1
        # For all states i at Beta(T-1, i) = 0
        beta_table[T - 1, :] = 0.0 # log(1) = 0


        # 3. Induction from T-2 to 0
        for t in range(T - 2, -1, -1): # Iterate backwards through time from T-2
            for i in range(N): # For each state i at qt
                # Calculate for all emissions probs for being at state j at t+1 when seeing Ot+1
                log_B_all_j_Ot1 = np.array([self._log_emission_prob(observations[t+1], j) for j in range(N)])

                # For all reachable states from current state i & they emission prob possible 
                valid_next_steps = (beta_table[t+1, :] > LOG_ZERO) & (log_B_all_j_Ot1 > LOG_ZERO)
                if np.any(valid_next_steps):
                    # Calculate the prob of beings at state i given the future obs sequence for all next posable states
                    terms = (
                            self.log_A[i, valid_next_steps] + \
                            log_B_all_j_Ot1[valid_next_steps] + \
                            beta_table[t+1, valid_next_steps])

                    beta_table[t, i] = logsumexp(terms)
                # All other invalid steps remains LOG_ZERO

        return beta_table # Return the completed beta table

    def _calculate_log_O(self, log_alpha):
        # Helper function to get log P(O|lambda) from the alpha table

        if log_alpha is None:
            return LOG_ZERO
        
        T = log_alpha.shape[0]
        if T == 0:
            return LOG_ZERO
        
        # calculates the sum for all alpha at time T to get the general P of the obs sequence to be in our model
        log_prob_O = logsumexp(log_alpha[T - 1, :])
        return log_prob_O

    def _calculate_gama(self, log_alpha, log_beta):
        # Check the tables exist and they both have the same dims
        if log_alpha is None or log_beta is None or log_alpha.shape != log_beta.shape:
            print("Gamma Error: Invalid alpha or beta tables.")
            return None

        T, N = log_alpha.shape
        if T == 0:
            print("Gamma Warning: Cannot calculate gamma for T=0.")
            return None


        # 1. Calculate total log probability P(O|lambda)
        log_prob_O = self._calculate_log_O(log_alpha)

        # Make sure the observation sequence is possible (P(O|lambda) > 0)
        if log_prob_O <= LOG_ZERO:
            print("Gamma Warning: Sequence probability is zero or invalid. Cannot calculate gamma.")
            # Return table of LOG_ZERO as gamma is undefined/zero
            return np.full((T, N), LOG_ZERO)


        # 2. Calculate unnormalized log gamma
        # Log probability of each state given the O before in and after it
        log_gamma_unnormalized = log_alpha + log_beta


        # 3. Normalize to get the probability
        # Normalize by the P(O|lambda) to so row will add up to 1
        log_gamma = log_gamma_unnormalized - log_prob_O

        # Second Numerical Normalization
        # Makes sure sum over states is exactly 0 for each time step
        for t in range(T):
            current_log_sum = logsumexp(log_gamma[t, :])
            if np.isfinite(current_log_sum): # Make sure not to subtract -inf
                log_gamma[t, :] -= current_log_sum

        return log_gamma

        # Inside HMM class in hmm_model.py

    def _calculate_xi(self, observations, log_alpha, log_beta, log_prob_O):
        #check the tables exist and have valid data
        if log_alpha is None or log_beta is None or log_prob_O <= LOG_ZERO:
            print("Xi Error: Invalid alpha, beta, or sequence probability.")
            return None

        T, N = log_alpha.shape
        # Check the obs sequence size (both alpha and beta must have the same dim)
        if T <= 1: # Need at least 2 time steps for transitions
             print("Xi Warning: Cannot calculate Xi for sequence length <= 1.")
             return None


        # 1. Initialize log Xi table with log(0)
        # Save the probability of transitining from each state NxN, at each time step at t - xT
        log_xi = np.full((T - 1, N, N), LOG_ZERO)


        # 2. Pre-calculate all emission probabilities
        # Will create a T-1xN table
        # Other wise for each state j at time t, we will need to calculate the same emisson for each state i- N times
        log_next_emission_probs = np.array([
            [self._log_emission_prob(observations[t + 1], j) for j in range(N)]
            for t in range(T - 1)
        ]) 


        # 3. Calculate Xi for each time step t from 0 to T-2
        for t in range(T - 1): # For each time t
            for i in range(N): # From state i at time t
                # Get the first component for the xi calculation
                log_alpha_t_i = log_alpha[t, i]
                if log_alpha_t_i <= LOG_ZERO:
                    continue # Skip if the path to i at t is imposable

                for j in range(N): # For each transitioning state j for i
                    # Get the rest of the needed components for the xi calculation
                    log_A_ij = self.log_A[i, j] # The prob of transitioning fro state i to j
                    log_B_j_Ot1 = log_next_emission_probs[t, j] # The prob of seeing state j at Ot
                    log_beta_t1_j = log_beta[t+1, j] # The prob of being at state j at t+1 knowing the next obs sequence

                    # Check that each of the proboilities valid for the rest of the components
                    if log_A_ij > LOG_ZERO and log_B_j_Ot1 > LOG_ZERO and log_beta_t1_j > LOG_ZERO:
                        # All parts of the path segment have non-zero probability

                        # Calculate the likelihood of xi_t_i_j
                        log_xi_likelihood = log_alpha_t_i + log_A_ij + log_B_j_Ot1 + log_beta_t1_j

                        # Normalize by the chance of O being in the model - P(O|lambda)
                        # To get the final xi probability
                        log_xi[t, i, j] = log_xi_likelihood - log_prob_O

        return log_xi

        # Inside HMM class in hmm_model.py

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

    def decode_to_phonemes(self, observations):
        """Calls Viterbi and converts state indices to phoneme names."""
        best_path, log_prob = self.viterbi_decode(observations)
         
        if best_path:
            phoneme_sequence = [self.index_map[idx] for idx in best_path]
            phoneme_sequence = ' -> '.join(phoneme_sequence)

        return best_path, phoneme_sequence, log_prob