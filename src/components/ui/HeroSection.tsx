import { Button } from '../../components/ui/button';
import { ArrowRight } from 'lucide-react';
import { MockCalculator } from './MockCalculator.tsx';

interface HeroSectionProps {
  onSignUp: () => void;
  isAuthenticated?: boolean;
  userRole?: 'admin' | 'junior' | null;
  onNavigate?: () => void;
}

export function HeroSection({ onSignUp, isAuthenticated, userRole, onNavigate }: HeroSectionProps) {
  // Determine button text and action based on auth state
  const getButtonConfig = () => {
    if (isAuthenticated && userRole) {
      return {
        text: userRole === 'admin' ? 'Go to Dashboard' : 'Go to Calculator',
        action: onNavigate || onSignUp
      };
    }
    return {
      text: 'Sign Up Now',
      action: onSignUp
    };
  };

  const { text, action } = getButtonConfig();

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 py-20 pt-32">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
        <div className="space-y-8 flex flex-col justify-center min-h-[60vh]">
          <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
            <span className="bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
              Empower Your Junior Brokers
            </span>
            <br />
            <span className="text-purple-200">
              to Close More FX Deals with Real-Time Pitch Intelligence
            </span>
          </h1>
          
          <p className="text-xl text-purple-200/80 leading-relaxed">
            Stop losing opportunities due to pitch errors—our tool provides instant rate comparisons, 
            savings calculations, and confidence-boosting insights for faster wins.
          </p>
          
          <div className="flex justify-center">
            <Button 
              onClick={action}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-8 py-4 text-lg rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              {text}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <div className="lg:pl-8">
          <MockCalculator />
        </div>
      </div>
    </section>
  );
}