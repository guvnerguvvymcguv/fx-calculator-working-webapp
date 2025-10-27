import { Zap, DollarSign, Database } from 'lucide-react';

export function USPSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="relative">
          {/* Enhanced glassmorphic card with 3D depth - border matches animated cards */}
          <div className="relative rounded-2xl p-1 bg-gradient-to-br from-purple-500/30 via-blue-500/30 to-purple-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_16px_48px_rgba(168,85,247,0.2),0_24px_64px_rgba(59,130,246,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_20px_56px_rgba(168,85,247,0.3),0_28px_72px_rgba(59,130,246,0.15),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-300">
            <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-xl rounded-2xl p-12 border-t border-white/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),inset_0_-1px_2px_rgba(0,0,0,0.1)]">
              {/* Top border highlight for depth */}
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              
              <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4 text-white">
                Close More FX Deals with Real-Time Pitch Intelligence
              </h2>
              <p className="text-center text-purple-200/80 mb-12 text-lg">
                Everything brokers need to win deals faster
              </p>
              
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center group">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 icon-container group-hover:bg-purple-500/30 transition-all duration-300 usp-icon-pulse">
                    <Zap className="h-8 w-8 text-purple-400 feature-icon" />
                  </div>
                  <h3 className="text-lg font-semibold text-purple-200 mb-2">
                    Live rate comparisons during client calls
                  </h3>
                </div>
                
                <div className="text-center group">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 icon-container group-hover:bg-blue-500/30 transition-all duration-300 usp-icon-pulse">
                    <DollarSign className="h-8 w-8 text-blue-400 feature-icon" />
                  </div>
                  <h3 className="text-lg font-semibold text-purple-200 mb-2">
                    Instant savings calculations that win deals
                  </h3>
                </div>
                
                <div className="text-center group">
                  <div className="w-16 h-16 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 icon-container group-hover:bg-green-500/30 transition-all duration-300 usp-icon-pulse">
                    <Database className="h-8 w-8 text-green-400 feature-icon" />
                  </div>
                  <h3 className="text-lg font-semibold text-purple-200 mb-2">
                    Automatic lead tracking for follow-ups
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
