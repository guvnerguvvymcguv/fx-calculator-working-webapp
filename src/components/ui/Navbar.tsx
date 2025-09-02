import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';

interface NavbarProps {
  isSignedIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function Navbar({ isSignedIn, onSignIn, onSignOut }: NavbarProps) {
  const handleHomeClick = () => {
    window.location.href = '/';
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
              className="text-purple-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              Home
            </Button>
            
            {isSignedIn ? (
              <Button 
                onClick={onSignOut}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-2 rounded-lg hover:shadow-purple-500/25 transition-all duration-200"
              >
                Sign Out
              </Button>
            ) : (
              <Button 
                onClick={onSignIn}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-2 rounded-lg hover:shadow-purple-500/25 transition-all duration-200"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}