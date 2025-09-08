import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';

// Import your components
import LandingPage from './components/LandingPage.tsx';
import LoginPage from './components/LoginPage.tsx';
import CalculatorPage from './components/CalculatorPage.tsx';
import PricingPage from './components/PricingPage.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import CompanySignup from './components/CompanySignup';
import SignupSuccess from './components/SignupSuccess';
import AdminDashboard from './components/AdminDashboard';
import UserActivity from './components/UserActivity';
import InviteMembers from './components/InviteMembers';
import SeatManagement from './components/SeatManagement';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import ResetPassword from './components/ResetPassword';

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

  useEffect(() => {
    // Handle Supabase auth redirects
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      // Check if it's a password reset
      if (hash.includes('type=recovery')) {
        // Navigate to reset-password page with the hash intact
        // Use navigate instead of window.location.replace to stay in React Router
        navigate('/reset-password' + hash);
      }
    }
  }, [navigate]);

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

        <Route path="/signup-success" element={<SignupSuccess />} />

        <Route path="/admin" element={<AdminDashboard />} />

        <Route path="/admin/user/:userId" element={<UserActivity />} />

        <Route path="/admin/invite" element={<InviteMembers />} />

        <Route path="/admin/seats" element={<SeatManagement />} />

        <Route path="/terms" element={<TermsOfService />} />
        
        <Route path="/privacy" element={<PrivacyPolicy />} />

        {/* Reset Password - accessible without authentication */}
        <Route path="/reset-password" element={<ResetPassword />} />

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