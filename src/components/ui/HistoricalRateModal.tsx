import { useState } from 'react';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Input } from './input';
import { X, Calendar, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { HistoricalChart } from './HistoricalChart';
import { useHistoricalRates } from '../../hooks/useHistoricalRates';

interface HistoricalRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPriceSelect: (price: number) => void;
  selectedPair?: string;
}

// Currency pairs configuration
const CURRENCY_PAIRS = [
  { value: 'GBPUSD', label: 'GBP/USD' },
  { value: 'GBPEUR', label: 'GBP/EUR' },
  { value: 'EURUSD', label: 'EUR/USD' },
  { value: 'GBPNOK', label: 'GBP/NOK' },
  { value: 'GBPSEK', label: 'GBP/SEK' },
  { value: 'GBPAUD', label: 'GBP/AUD' }
];

const TIMEFRAMES = ['1D', '5D', '1M', '3M'];

export function HistoricalRateModal({ 
  isOpen, 
  onClose, 
  onPriceSelect,
  selectedPair: initialPair = 'GBPUSD'
}: HistoricalRateModalProps) {
  if (!isOpen) return null;

  const {
    selectedPair,
    selectedTimeframe,
    chartData,
    isLoading,
    error,
    setSelectedPair,
    setSelectedTimeframe,
    fetchRateForDateTime
  } = useHistoricalRates(initialPair);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [searchedRate, setSearchedRate] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const formatSelectedDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Handle date selection
  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
  };

  // Handle month navigation
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  // Find rate for specific date/time
  const handleFindRate = async () => {
    setIsSearching(true);
    try {
      const rate = await fetchRateForDateTime(selectedDate, selectedTime);
      if (rate !== null) {
        setSearchedRate(rate);
      }
    } catch (error) {
      console.error('Error finding rate:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Use the found rate
  const handleUseRate = () => {
    if (searchedRate !== null) {
      onPriceSelect(searchedRate);
      onClose();
    }
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Historical Exchange Rates</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Currency Pair Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-gray-300">Pair:</span>
              <Select value={selectedPair} onValueChange={setSelectedPair}>
                <SelectTrigger className="w-32 bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {CURRENCY_PAIRS.map((pair) => (
                    <SelectItem 
                      key={pair.value} 
                      value={pair.value}
                      className="text-gray-300 hover:bg-gray-700"
                    >
                      {pair.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Timeframe Buttons */}
            <div className="flex items-center gap-2">
              <span className="text-gray-300">Timeframe:</span>
              <div className="flex gap-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSelectedTimeframe(tf)}
                    className={`px-3 py-1 rounded transition-colors ${
                      selectedTimeframe === tf
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Date/Time Search Toggle */}
            <Button
              onClick={() => setShowDatePicker(!showDatePicker)}
              variant="outline"
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Date/Time Search
            </Button>

            {showDatePicker && (
              <Button
                onClick={() => setShowDatePicker(false)}
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                Reset View
              </Button>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-sm text-gray-400 flex items-start gap-2">
              <span className="text-purple-400">💡</span>
              <span>
                {showDatePicker 
                  ? "Select a specific date and time to find the historical rate"
                  : "Use the Date/Time Search for specific rates, or hover over the chart to see historical rates and click on any point to select that rate for your calculation."
                }
              </span>
            </p>
          </div>

          {/* Date/Time Picker */}
          {showDatePicker && (
            <div className="bg-gray-800 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Calendar */}
                <div>
                  <h3 className="text-gray-300 mb-2">Select Date</h3>
                  <div className="bg-gray-900 rounded-lg p-3">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => navigateMonth('prev')}
                        className="text-gray-400 hover:text-white"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <span className="text-white font-medium">
                        {formatMonthYear(currentMonth)}
                      </span>
                      <button
                        onClick={() => navigateMonth('next')}
                        className="text-gray-400 hover:text-white"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-xs text-gray-500 py-1">
                          {day}
                        </div>
                      ))}
                      {calendarDays.map((day, index) => (
                        <div key={index} className="aspect-square">
                          {day && (
                            <button
                              onClick={() => handleDateSelect(day)}
                              className={`w-full h-full rounded hover:bg-gray-700 transition-colors ${
                                selectedDate.getDate() === day &&
                                selectedDate.getMonth() === currentMonth.getMonth()
                                  ? 'bg-purple-600 text-white'
                                  : 'text-gray-300'
                              }`}
                            >
                              {day}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Time & Search */}
                <div>
                  <h3 className="text-gray-300 mb-2">Time & Search</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400">Selected Date:</label>
                      <div className="text-white font-medium">
                        {formatSelectedDate(selectedDate)}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400">Time (e.g., 13:00, 1:00 PM, 1pm)</label>
                      <Input
                        type="text"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="bg-gray-900 border-gray-700 text-white"
                        placeholder="09:00"
                      />
                    </div>

                    <Button
                      onClick={handleFindRate}
                      disabled={isSearching}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      {isSearching ? 'Searching...' : 'Find Rate'}
                    </Button>

                    {searchedRate !== null && (
                      <div className="bg-gray-900 rounded-lg p-3 space-y-2">
                        <div className="text-sm text-gray-400">Rate Found:</div>
                        <div className="text-2xl font-bold text-green-400">
                          {searchedRate.toFixed(4)}
                        </div>
                        <Button
                          onClick={handleUseRate}
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                          Use This Rate
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="h-64 md:h-96">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-400">Loading chart data...</div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-red-400">{error}</div>
                </div>
              ) : (
                <HistoricalChart
                      data={chartData as any}
                      onPriceSelect={(price: number) => {
                        onPriceSelect(price);
                        onClose();
                      } } selectedPair={''}                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}