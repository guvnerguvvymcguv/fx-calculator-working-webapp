import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from './lib/supabase';

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
import JoinPage from './components/JoinPage';
import SalesforceCallback from './components/SalesforceCallback';
import SalesforceSettings from './components/SalesforceSettings';
import AccountManagement from './components/AccountManagement';
import Checkout from './components/Checkout';
import EmailPreview from './components/EmailPreview';

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
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    // Handle Supabase auth redirects
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      // Check if it's a password reset
      if (hash.includes('type=recovery')) {
        // Navigate to reset-password page with the hash intact
        navigate('/reset-password' + hash);
      }
    }

    return () => subscription.unsubscribe();
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    logout();
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

        <Route path="/admin" element={
          <ProtectedRoute adminOnly={true}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="/admin/user/:userId" element={
          <ProtectedRoute adminOnly={true}>
            <UserActivity />
          </ProtectedRoute>
        } />

        <Route path="/admin/invite" element={
          <ProtectedRoute adminOnly={true}>
            <InviteMembers />
          </ProtectedRoute>
        } />

        <Route path="/admin/seats" element={
          <ProtectedRoute adminOnly={true}>
            <SeatManagement />
          </ProtectedRoute>
        } />

        <Route path="/terms" element={<TermsOfService />} />
        
        <Route path="/privacy" element={<PrivacyPolicy />} />

        <Route path="/admin/account" element={
          <ProtectedRoute adminOnly={true}>
            <AccountManagement />
          </ProtectedRoute>
        } />

        {/* Reset Password - accessible without authentication */}
        <Route path="/reset-password" element={<ResetPassword />} />

        // Add this route with your other routes
        <Route path="/join" element={<JoinPage />} />

        <Route path="/salesforce-callback" element={<SalesforceCallback />} />

        <Route path="/checkout" element={<Checkout />} />

        <Route path="/admin/salesforce-settings" element={
          <ProtectedRoute>
            <SalesforceSettings />
          </ProtectedRoute>
        } />

        <Route path="/email-preview" element={
  <ProtectedRoute>
    <EmailPreview />
  </ProtectedRoute>
} />

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