import { useState, useEffect } from 'react';
import { X, TrendingUp, Calendar, DollarSign } from 'lucide-react';
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
  calculation_data: {
    currency_pair: string;
    your_rate: number;
    competitor_rate: number;
    trade_amount: number;
    trades_per_year: number;
    pips_added: number;
    savings_per_trade: number;
    annual_savings: number;
    percentage_savings: number;
  };
  savings_amount: number;
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
      const { data, error } = await supabase
        .from('calculations')
        .select('*')
        .eq('normalized_client_name', normalizedName)
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
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#1a0b2e] rounded-lg border border-white/20 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-purple-100 mb-1">
                {companyName}
              </h2>
              <p className="text-purple-300 text-sm">
                Calculation History ({calculations.length} total)
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
        <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
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
            <div className="space-y-4">
              {calculations.map((calc) => (
                <div
                  key={calc.id}
                  className="p-5 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                >
                  {/* Date & Currency Pair Header */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-purple-300" />
                      <span className="text-purple-200 font-medium">
                        {new Date(calc.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <span className="px-3 py-1 bg-purple-600/30 text-purple-200 rounded-lg text-sm font-medium">
                      {calc.calculation_data.currency_pair}
                    </span>
                  </div>

                  {/* Calculation Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-purple-300 mb-1">Your Rate</p>
                      <p className="text-lg font-semibold text-purple-100">
                        {calc.calculation_data.your_rate?.toFixed(4) || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-300 mb-1">Competitor Rate</p>
                      <p className="text-lg font-semibold text-purple-100">
                        {calc.calculation_data.competitor_rate?.toFixed(4) || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-300 mb-1">Trade Amount</p>
                      <p className="text-lg font-semibold text-purple-100">
                        {calc.calculation_data.trade_amount?.toLocaleString() || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-300 mb-1">Trades/Year</p>
                      <p className="text-lg font-semibold text-purple-100">
                        {calc.calculation_data.trades_per_year || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-300 mb-1">Pips Added</p>
                      <p className="text-lg font-semibold text-purple-100">
                        {calc.calculation_data.pips_added || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-purple-300 mb-1">Savings/Trade</p>
                      <p className="text-lg font-semibold text-green-400">
                        £{calc.calculation_data.savings_per_trade?.toFixed(2) || calc.savings_amount?.toFixed(2) || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Annual Savings - Highlighted */}
                  {calc.calculation_data.annual_savings && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-green-400" />
                          <span className="text-sm text-purple-300">Annual Savings</span>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-400">
                            £{calc.calculation_data.annual_savings.toFixed(2)}
                          </p>
                          {calc.calculation_data.percentage_savings && (
                            <p className="text-sm text-green-300">
                              ({calc.calculation_data.percentage_savings.toFixed(2)}% saved)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
