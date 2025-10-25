import { Button } from '../../components/ui/button';
import { TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';  // Add this import

interface FooterProps {
  onLogin: () => void;
}

export function Footer({ onLogin }: FooterProps) {
  return (
    <footer className="border-t border-white/10 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-purple-400" />
            <span className="text-xl font-bold bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
              Spread Checker
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            <Link 
              to="/terms"
              className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200 px-4 py-2 rounded-md"
            >
              Terms of Service
            </Link>
            <Link 
              to="/privacy"
              className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200 px-4 py-2 rounded-md"
            >
              Privacy Policy
            </Link>
            <Button 
              onClick={onLogin}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              Sign In
            </Button>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-white/10 text-center">
          <p className="text-purple-200/60">
            © 2025 Spread Checker. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}