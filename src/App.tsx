import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';

// Import your components
import LandingPage from './components/LandingPage.tsx';
import LoginPage from './components/LoginPage.tsx';
import CalculatorPage from './components/CalculatorPage.tsx';
import PricingPage from './components/PricingPage.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import CompanySignup from './components/CompanySignup';

// Create a simple auth context for global state
interface AuthContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export const AuthContext = React.createContext<AuthContextType | null>(null);

// Wrapper component to use navigation hooks
function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  const login = () => {
    setIsAuthenticated(true);
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  // Handler functions for sign in/out
  const handleSignIn = () => {
    // Navigate to login page
    navigate('/login');
  };

  const handleSignOut = () => {
    logout();
    // Optionally navigate to home after sign out
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      <Routes>
        {/* Landing Page - now with auth props */}
        <Route 
          path="/" 
          element={
            <LandingPage 
              isAuthenticated={isAuthenticated}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />
          } 
        />
        
        {/* Login Page */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected Calculator Page */}
        <Route 
          path="/calculator" 
          element={
            <ProtectedRoute>
              <CalculatorPage />
            </ProtectedRoute>
          } 
        />

        <Route path="/pricing" element={<PricingPage />} />

        <Route path="/signup" element={<CompanySignup />} />
        
        {/* Redirect any unknown routes to landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;