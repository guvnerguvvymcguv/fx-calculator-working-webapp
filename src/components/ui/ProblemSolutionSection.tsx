import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
          {/* Problem */}
          <Card className="bg-red-500/10 backdrop-blur-md border-red-500/20 rounded-xl p-6 w-full">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-red-400" />
              </div>
              <CardTitle className="text-xl text-red-300">The Pain Point</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-purple-200/80 mb-4">
                Junior brokers often fluff rate comparisons on calls, leading to lost deals and frustrated clients.
              </p>
            </CardContent>
          </Card>

          {/* Arrow - always pointing down */}
          <div className="flex items-center justify-center">
            <ArrowRight className="h-8 w-8 text-purple-400 transform rotate-90" />
          </div>

          {/* Solution */}
          <Card className="bg-green-500/10 backdrop-blur-md border-green-500/20 rounded-xl p-6 w-full">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <CardTitle className="text-xl text-green-300">Our Solution</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}