import { AnimatedCard } from './AnimatedCard';
import { FileText, TrendingUp, Save } from 'lucide-react';

export function HowItWorksSection() {
  const steps = [
    {
      number: "1",
      icon: FileText,
      title: "Input Deal Details",
      description: "Enter competitor rate, trade volume, and client information",
      iconBg: "bg-purple-500/20",
      iconColor: "text-purple-400",
      numberBg: "bg-purple-600"
    },
    {
      number: "2",
      icon: TrendingUp,
      title: "See Instant Savings",
      description: "View PIPs advantage, per-trade savings, and annual projections",
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-400",
      numberBg: "bg-blue-600"
    },
    {
      number: "3",
      icon: Save,
      title: "Save Your Lead",
      description: "Automatically stores calculation to revisit and track prospects",
      iconBg: "bg-green-500/20",
      iconColor: "text-green-400",
      numberBg: "bg-green-600"
    }
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
            How It Works
          </h2>
          <p className="text-xl text-purple-200/80">Close deals in three simple steps</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const IconComponent = step.icon;
            
            return (
              <AnimatedCard key={index}>
                <div className="p-8 text-center">
                  {/* Step Number */}
                  <div className={`w-12 h-12 ${step.numberBg} rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-xl step-number`}>
                    {step.number}
                  </div>
                  
                  {/* Icon */}
                  <div className={`w-16 h-16 ${step.iconBg} rounded-xl flex items-center justify-center mx-auto mb-4 icon-container`}>
                    <IconComponent className={`h-8 w-8 ${step.iconColor} feature-icon`} />
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-3 text-purple-200">{step.title}</h3>
                  <p className="text-purple-200/70">
                    {step.description}
                  </p>
                </div>
              </AnimatedCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
