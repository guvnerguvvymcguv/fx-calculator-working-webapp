import { Target, CheckCircle, ArrowRight } from 'lucide-react';

export default function ProblemSolutionSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
            The Problem Costing You Deals
          </h2>
        </div>
        
        <div className="flex flex-col gap-8 items-center max-w-2xl mx-auto">
          {/* Problem - Enhanced 3D with Red Glow */}
          <div className="w-full bg-gradient-to-b from-red-500/10 to-red-500/5 backdrop-blur-xl border-red-500/30 rounded-xl shadow-[0_0_32px_rgba(239,68,68,0.15),0_0_48px_rgba(239,68,68,0.1),0_0_64px_rgba(239,68,68,0.05),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(239,68,68,0.25),0_0_60px_rgba(239,68,68,0.15),0_0_80px_rgba(239,68,68,0.1),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-300 hover:-translate-y-1 border-t-red-500/20 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0 icon-container group transition-all duration-300">
                <Target className="h-6 w-6 text-red-400 feature-icon" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-red-300 mb-3">The Pain Point</h3>
                <p className="text-purple-200/80">
                  Brokers often fluff rate comparisons on calls, leading to lost deals and frustrated clients.
                </p>
              </div>
            </div>
          </div>

          {/* Arrow - always pointing down */}
          <div className="flex items-center justify-center">
            <ArrowRight className="h-8 w-8 text-purple-400 transform rotate-90" />
          </div>

          {/* Solution - Enhanced 3D with Green Glow */}
          <div className="w-full bg-gradient-to-b from-green-500/10 to-green-500/5 backdrop-blur-xl border-green-500/30 rounded-xl shadow-[0_0_32px_rgba(34,197,94,0.15),0_0_48px_rgba(34,197,94,0.1),0_0_64px_rgba(34,197,94,0.05),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(34,197,94,0.25),0_0_60px_rgba(34,197,94,0.15),0_0_80px_rgba(34,197,94,0.1),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-300 hover:-translate-y-1 border-t-green-500/20 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0 icon-container group transition-all duration-300">
                <CheckCircle className="h-6 w-6 text-green-400 feature-icon" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-green-300 mb-3">Our Solution</h3>
                <p className="text-purple-200/80 mb-4">
                  Our calculator reduces errors, boosts close rates by highlighting savings, and builds confidence to cut turnover.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-green-200 text-sm">Instant rate comparisons</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-green-200 text-sm">Confidence-building insights</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-green-200 text-sm">Reduced pitch errors</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
