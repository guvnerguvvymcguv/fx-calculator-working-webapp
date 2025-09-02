import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calculator, TrendingUp, DollarSign } from 'lucide-react';

export function MockCalculator() {
  const today = new Date().toLocaleDateString('en-US');
  
  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-xl shadow-xl max-w-lg mx-auto" style={{ color: '#C7B3FF' }}>
      <CardHeader className="text-center pb-3">
        <div className="flex items-center justify-center gap-2 mb-2">
          <TrendingUp className="h-6 w-6 text-purple-400" />
          <CardTitle className="text-lg font-bold bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
            Spread Checker
          </CardTitle>
        </div>
        <CardDescription className="text-purple-200/80 text-xs">
          Calculate competitive advantages and client savings in real-time
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Currency Pair */}
        <div className="space-y-1">
          <Label className="text-xs text-purple-200">Currency Pair</Label>
          <div className="bg-white/10 border-white/20 text-purple-100 p-2 rounded-lg text-sm">
            GBP/USD
          </div>
        </div>

        {/* Live Rate Display */}
        <div className="p-2 bg-white/5 rounded-lg border border-white/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <Label className="text-xs text-purple-200">Live Market Rate: GBP/USD</Label>
          </div>
          <div className="text-base font-bold text-green-400">
            1.3556
          </div>
        </div>
        
        {/* Your Rate, Competitor Rate, Historical Rate Button - Row 1 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-purple-200">Your Rate</Label>
            <div className="bg-white/10 border-white/20 text-purple-100 p-1.5 rounded-lg text-sm">
              1.355
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-purple-200">Competitor</Label>
            <div className="bg-white/10 border-white/20 text-purple-100 p-1.5 rounded-lg text-sm">
              1.354
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-purple-200 opacity-0">Hidden</Label>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-purple-200 hover:bg-white/10 text-xs h-8 w-full px-1"
            >
              Historical Rate
            </Button>
          </div>
        </div>

        {/* Client Name and Comparison Date - Row 2 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-purple-200">Client Name</Label>
            <div className="bg-white/10 border-white/20 text-purple-100 p-1.5 rounded-lg text-sm">
              ExampleBroker.com
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-purple-200">Comparison Date</Label>
            <div className="bg-white/5 border-white/20 text-purple-100 p-1.5 rounded-lg text-sm">
              {today}
            </div>
          </div>
        </div>

        {/* Amount to Buy and Trades Per Year - Row 3 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-purple-200">Amount to Buy</Label>
            <div className="bg-white/10 border-white/20 text-purple-100 p-1.5 rounded-lg text-sm">
              500000
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-purple-200">Trades Per Year</Label>
            <div className="bg-white/10 border-white/20 text-purple-100 p-1.5 rounded-lg text-sm">
              52
            </div>
          </div>
        </div>

        {/* Pip Selection */}
        <div className="p-2 bg-white/5 rounded-lg border border-white/20">
          <Label className="text-xs text-purple-200 mb-2 block">
            Inflate Your Margin (Pips)
          </Label>
          <div className="flex flex-wrap gap-1">
            {[
              { label: 'None', selected: true },
              { label: '10 pips', selected: false },
              { label: '20 pips', selected: false },
              { label: '30 pips', selected: false },
              { label: '40 pips', selected: false },
              { label: '50 pips', selected: false }
            ].map((pip, index) => (
              <div key={index} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                pip.selected
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-purple-200'
              }`}>
                {pip.label}
              </div>
            ))}
          </div>
        </div>
        
        {/* Calculate Button */}
        <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-2 rounded-lg shadow-lg hover:shadow-purple-400/60 hover:shadow-[0_0_20px_rgba(147,51,234,0.6)] transition-all duration-200">
          <Calculator className="mr-2 h-4 w-4" />
          Calculate Savings
        </Button>

        {/* Results Display - Compact Layout */}
        <div className="p-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg border border-purple-400/30">
          <h3 className="text-sm font-semibold text-purple-200 mb-2 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Calculation Results
          </h3>
          
          <div className="space-y-2">
            {/* Row 1: Price Difference, Pips, Percentage Savings */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-purple-300">Price Difference</p>
                <p className="text-sm font-bold text-purple-100">+0.0010</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs text-purple-300">Pips</p>
                <p className="text-sm font-bold text-purple-100">10.0 pips</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-xs text-purple-300">% Savings</p>
                <p className="text-sm font-bold text-green-400">0.07%</p>
              </div>
            </div>
            
            {/* Row 2: Cost With Competitor, [space], Cost With Us */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-purple-300">Cost With Competitor</p>
                <p className="text-sm font-bold text-red-400">369276.22</p>
              </div>
              <div></div>
              <div className="space-y-1 text-right">
                <p className="text-xs text-purple-300">Cost With Us</p>
                <p className="text-sm font-bold text-green-400">369003.69</p>
              </div>
            </div>
            
            {/* Row 3: Savings Per Trade, [space], Annual Savings */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-purple-300">Savings Per Trade</p>
                <p className="text-sm font-bold text-green-400">272.53</p>
              </div>
              <div></div>
              <div className="space-y-1 text-right">
                <p className="text-xs text-purple-300">Annual Savings</p>
                <p className="text-base font-bold text-green-400">14171.49</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}