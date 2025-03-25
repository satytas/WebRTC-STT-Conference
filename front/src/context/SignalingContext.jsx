import { createContext, useContext, useMemo } from 'react';
import { SignalingClient } from '../utils/SignalingClient';

const  SignalingContext = createContext(null);

export function SignalingProvider({ children }) {
    const userId = sessionStorage.getItem('userId') || Math.random().toString(36).slice(2, 6);
    sessionStorage.setItem('userId', userId);

    const signalingClient = useMemo(() => new SignalingClient(userId), [userId])

    return (
        <SignalingContext.Provider value={signalingClient}>
            {children}
        </SignalingContext.Provider>
    );
}

export function useSignaling() {
    const context = useContext(SignalingContext);
    if (!context) {
        throw new Error('useSignaling must be used within a SignalingProvider');
    }
    
    return context;
}