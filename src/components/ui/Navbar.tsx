import { Button } from '../../components/ui/button';
import { TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

interface NavbarProps {
  isSignedIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  userRole?: 'admin' | 'junior' | null;
  loading?: boolean;
}

export function Navbar({ isSignedIn, onSignIn, onSignOut, userRole, loading }: NavbarProps) {
  const handleHomeClick = () => {
    window.location.href = '/';
  };

  // Determine button text based on auth state and role
  const getAuthButtonText = () => {
    if (loading) return 'Loading...';
    if (!isSignedIn) return 'Sign In';
    if (userRole === 'admin') return 'Dashboard';
    if (userRole === 'junior') return 'Calculator';
    return 'Sign In';
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/5 backdrop-blur-md border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-purple-400" />
            <span className="text-xl font-bold bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
              Spread Checker
            </span>
          </div>
          
          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <Button 
              variant="ghost" 
              onClick={handleHomeClick}
              className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
            >
              Home
            </Button>

            <Link to="/pricing">
              <Button 
                variant="ghost"
                className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
              >
                Pricing
              </Button>
            </Link>
            
            {/* Auth Button Group */}
            <div className="flex items-center gap-2">
              {isSignedIn && userRole ? (
                <>
                  <Button 
                    onClick={onSignIn}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                    disabled={loading}
                  >
                    {getAuthButtonText()}
                  </Button>
                  <Button 
                    onClick={onSignOut}
                    variant="ghost"
                    className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={onSignIn}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                  disabled={loading}
                >
                  {getAuthButtonText()}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}