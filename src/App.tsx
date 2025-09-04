import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';

// Import your components
import LandingPage from './components/LandingPage.tsx';
import LoginPage from './components/LoginPage.tsx';
import CalculatorPage from './components/CalculatorPage.tsx';
import PricingPage from './components/PricingPage.tsx';

// Create a simple auth context for global state
interface AuthContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export const AuthContext = React.createContext<AuthContextType | null>(null);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = () => {
    setIsAuthenticated(true);
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  // Handler functions for sign in/out
  const handleSignIn = () => {
    login();
  };

  const handleSignOut = async () => {
    logout();
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      <BrowserRouter>
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
              isAuthenticated ? 
                <CalculatorPage /> : 
                <Navigate to="/login" replace />
            } 
          />

          <Route path="/pricing" element={<PricingPage />} />
          
          {/* Redirect any unknown routes to landing page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;