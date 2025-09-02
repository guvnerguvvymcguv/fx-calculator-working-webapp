import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';

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
            <Button 
              variant="ghost" 
              onClick={onLogin}
              className="text-purple-200 hover:text-white hover:bg-white/10"
            >
              Login
            </Button>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-white/10 text-center">
          <p className="text-purple-200/60">
            © 2025 FX Pitch Calculator. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}