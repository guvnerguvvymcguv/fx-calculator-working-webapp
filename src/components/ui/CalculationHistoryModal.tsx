import { useState, useEffect } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { Button } from './button';
import { supabase } from '../../lib/supabase';

interface CalculationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  normalizedName: string;
}

interface Calculation {
  id: string;
  created_at: string;
  client_name: string;
  currency_pair: string;
  your_rate: number;
  competitor_rate: number;
  amount: number;
  amount_to_buy: number;
  trades_per_year: number;
  payment_amount: number; // PIPs
  pips_difference: number;
  savings_per_trade: number;
  annual_savings: number;
  percentage_savings: number;
  cost_with_competitor: number;
  cost_with_us: number;
  comparison_date: string;
  price_difference: number;
}

export function CalculationHistoryModal({
  isOpen,
  onClose,
  companyName,
  normalizedName
}: CalculationHistoryModalProps) {
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadCalculations();
    }
  }, [isOpen, normalizedName]);

  const loadCalculations = async () => {
    setIsLoading(true);
    try {
      // Query activity_logs - this is what admins see
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('action_type', 'calculation')
        .ilike('client_name', companyName)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCalculations(data || []);
    } catch (error) {
      console.error('Error loading calculations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-7xl max-h-[90vh] bg-[#1a0b2e] rounded-lg border border-white/20 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10 p-6 z-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-purple-100 mb-1">
                Calculation Details
              </h2>
              <p className="text-purple-300 text-sm">
                {companyName} ({calculations.length} calculations)
              </p>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-purple-200 hover:text-white hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4" />
              <p className="text-purple-300">Loading calculations...</p>
            </div>
          ) : calculations.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-purple-300 mx-auto mb-4 opacity-50" />
              <p className="text-purple-200 mb-2">No calculations yet</p>
              <p className="text-purple-300/60 text-sm">
                This company has been added but no calculations have been performed.
              </p>
            </div>
          ) : (
            <div className="min-w-max">
              {/* Table matching admin format exactly */}
              {calculations.map((calc, index) => (
                <div
                  key={calc.id}
                  className={`p-6 border-b border-white/10 ${
                    index % 2 === 0 ? 'bg-white/5' : 'bg-transparent'
                  } hover:bg-white/10 transition-colors`}
                >
                  {/* Row 1: Time & Date, Currency Pair, Rates, Client Info */}
                  <div className="grid grid-cols-6 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-purple-400 mb-1">Time & Date</p>
                      <p className="text-sm font-medium text-white">
                        {new Date(calc.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short'
                        })}, {new Date(calc.created_at).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-400 mb-1">Currency Pair</p>
                      <p className="text-sm font-semibold text-white">
                        {calc.currency_pair || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-400 mb-1">Your Rate</p>
                      <p className="text-sm font-medium text-white">
                        {calc.your_rate?.toFixed(4) || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-400 mb-1">Comp Rate</p>
                      <p className="text-sm font-medium text-white">
                        {calc.competitor_rate?.toFixed(4) || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-400 mb-1">Client Name</p>
                      <p className="text-sm font-medium text-white">
                        {calc.client_name || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-400 mb-1">Comp Date</p>
                      <p className="text-sm font-medium text-white">
                        {calc.comparison_date ? new Date(calc.comparison_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }) : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Row 2: Trade Details */}
                  <div className="grid grid-cols-6 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-purple-400 mb-1">Amt to Buy</p>
                      <p className="text-sm font-medium text-white">
                        £{calc.amount_to_buy?.toLocaleString() || calc.amount?.toLocaleString() || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-400 mb-1">Trades/Year</p>
                      <p className="text-sm font-medium text-white">
                        {calc.trades_per_year || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-400 mb-1">Price Diff</p>
                      <p className={`text-sm font-medium ${
                        (calc.price_difference || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {calc.price_difference >= 0 ? '+' : ''}{calc.price_difference?.toFixed(4) || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-400 mb-1">PIPs</p>
                      <p className={`text-sm font-medium ${
                        (calc.payment_amount || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {calc.payment_amount || calc.pips_difference || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-400 mb-1">Cost w/ Comp</p>
                      <p className="text-sm font-medium text-red-300">
                        £{calc.cost_with_competitor?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-400 mb-1">Cost w/ Us</p>
                      <p className="text-sm font-medium text-green-300">
                        £{calc.cost_with_us?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Row 3: Savings Summary */}
                  <div className="grid grid-cols-6 gap-4 pt-3 border-t border-white/10">
                    <div>
                      <p className="text-xs text-purple-400 mb-1">Savings/Trade</p>
                      <p className="text-sm font-semibold text-green-400">
                        £{calc.savings_per_trade?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-400 mb-1">Annual Savings</p>
                      <p className="text-sm font-bold text-green-400">
                        £{calc.annual_savings?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-400 mb-1">% Savings</p>
                      <p className="text-sm font-medium text-green-400">
                        {calc.percentage_savings?.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
