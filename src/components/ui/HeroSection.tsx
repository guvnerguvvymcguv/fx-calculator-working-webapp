import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { MockCalculator } from './MockCalculator.tsx';

interface HeroSectionProps {
  onSignUp: () => void;
}

export function HeroSection({ onSignUp }: HeroSectionProps) {
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
              onClick={onSignUp}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-8 py-4 text-lg rounded-lg shadow-lg hover:shadow-purple-400/60 hover:shadow-[0_0_20px_rgba(147,51,234,0.6)] transition-all duration-200"
            >
              Sign Up Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <div className="lg:pl-8">
          <Card className="bg-white/5 backdrop-blur-md border-white/20 rounded-xl shadow-2xl p-6 hover:scale-105 transition-transform duration-300">
            <MockCalculator />
          </Card>
        </div>
      </div>
    </section>
  );
}