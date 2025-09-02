import React from 'react';
import { Card } from '@/components/ui/card';
import { 
  Zap, 
  Calculator, 
  Users, 
  Target,
  TrendingUp
} from 'lucide-react';

interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  iconBgColor: string;
  iconColor: string;
}

const features: Feature[] = [
  {
    icon: Zap,
    title: "Real-Time FX Comparisons",
    description: "Live market rates to allow for instant competitor comparisons to showcase your competitive advantage.",
    iconBgColor: "bg-purple-500/20",
    iconColor: "text-purple-400"
  },
  {
    icon: Calculator,
    title: "Instant PIPs & Savings",
    description: "Automatic calculations of PIPs advantage, per-trade savings, and annual projections.",
    iconBgColor: "bg-blue-500/20",
    iconColor: "text-blue-400"
  },
  {
    icon: Users,
    title: "Team Access & Discounts",
    description: "Multiple user accounts with bulk pricing.",
    iconBgColor: "bg-green-500/20",
    iconColor: "text-green-400"
  },
  {
    icon: Target,
    title: "Confidence Builder",
    description: "Clear, professional presentations that help junior brokers deliver with authority.",
    iconBgColor: "bg-red-500/20",
    iconColor: "text-red-400"
  },
  {
    icon: TrendingUp,
    title: "Historical FX Comparisons",
    description: "Access historical exchange rate data to compare with clients historical buys.",
    iconBgColor: "bg-orange-500/20",
    iconColor: "text-orange-400"
  }
];

export function FeaturesGrid() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
            Powerful Features for Trading Success
          </h2>
          <p className="text-xl text-purple-200/80">Everything your team needs to close more FX deals</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8">
          {features.slice(0, 4).map((feature, index) => {
            const IconComponent = feature.icon;
            
            return (
              <Card 
                key={index}
                className="bg-white/5 backdrop-blur-md border-white/20 rounded-xl p-6 hover:bg-white/10 transition-all duration-200"
              >
                <div className={`w-12 h-12 ${feature.iconBgColor} rounded-lg flex items-center justify-center mb-4`}>
                  <IconComponent className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-purple-200">{feature.title}</h3>
                <p className="text-purple-200/70">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>
        
        {/* Fifth feature spanning full width */}
        <div className="mt-8">
          <Card className="bg-white/5 backdrop-blur-md border-white/20 rounded-xl p-6 hover:bg-white/10 transition-all duration-200">
            <div className={`w-12 h-12 ${features[4].iconBgColor} rounded-lg flex items-center justify-center mb-4`}>
              <TrendingUp className={`h-6 w-6 ${features[4].iconColor}`} />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-purple-200">{features[4].title}</h3>
            <p className="text-purple-200/70">
              {features[4].description}
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}