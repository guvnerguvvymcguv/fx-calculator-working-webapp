import { useState } from 'react';

interface LoginResult {
  success: boolean;
  error?: string;
}

interface UseAuthReturn {
  isSignedIn: boolean;
  isLoading: boolean;
  loginCode: string;
  error: string;
  login: (code: string) => Promise<LoginResult>;
  logout: () => void;
  setLoginCode: (code: string) => void;
  clearError: () => void;
}

/**
 * Custom hook for authentication state and logic
 * Handles login, logout, and authentication status
 */
export const useAuth = (): UseAuthReturn => {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginCode, setLoginCode] = useState<string>('');
  const [error, setError] = useState<string>('');

  const login = async (code: string): Promise<LoginResult> => {
    setIsLoading(true);
    setError('');
    
    // Simple delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (code === '123456') {
      setIsSignedIn(true);
      setLoginCode('');
      setIsLoading(false);
      return { success: true };
    } else {
      setError('Invalid code');
      setIsLoading(false);
      return { success: false, error: 'Invalid code' };
    }
  };

  const logout = (): void => {
    setIsSignedIn(false);
    setLoginCode('');
    setError('');
    // In real app: clear auth tokens, redirect, etc.
  };

  const updateLoginCode = (code: string): void => {
    setLoginCode(code);
    // Clear error when user starts typing
    if (error) setError('');
  };

  const clearError = (): void => {
    setError('');
  };

  return {
    // State
    isSignedIn,
    isLoading,
    loginCode,
    error,
    
    // Actions
    login,
    logout,
    setLoginCode: updateLoginCode,
    clearError
  };
};