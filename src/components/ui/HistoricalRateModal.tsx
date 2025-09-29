import { useState } from 'react';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Input } from './input';
import { X, Calendar, Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { HistoricalChart } from './HistoricalChart';
import { useHistoricalRates } from '../../hooks/useHistoricalRates';
import { getMaxHistoricalDate } from '../../lib/tradermade';

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

// Helper to format data precision for display
const formatDataPrecision = (precision: 'minute' | 'hourly' | 'daily', isToday?: boolean): string => {
  switch (precision) {
    case 'minute':
      return isToday ? 'Minute precision (today only)' : 'Minute precision';
    case 'hourly':
      return 'Hourly precision';
    case 'daily':
      return 'Daily precision only';
  }
};

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
    isRealData,
    dataPrecision,
    setSelectedPair,
    setSelectedTimeframe,
    fetchRateForDateTime
  } = useHistoricalRates(initialPair);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [searchedRate, setSearchedRate] = useState<number | null>(null);
  const [searchPrecision, setSearchPrecision] = useState<'minute' | 'hourly' | 'daily' | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get max available date for historical data
  const maxAvailableDate = getMaxHistoricalDate();
  const today = new Date();
  const thirtyDaysAgo = new Date(maxAvailableDate);
  thirtyDaysAgo.setDate(maxAvailableDate.getDate() - 30);

  // Check if date is today
  const isToday = (date: Date): boolean => {
    return date.toDateString() === today.toDateString();
  };

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

  // Check if a date is available for historical data
  const isDateAvailable = (year: number, month: number, day: number): boolean => {
    const checkDate = new Date(year, month, day);
    return checkDate <= maxAvailableDate && checkDate >= new Date('2018-01-01');
  };

  // Check what precision is available for a date
  const getDatePrecision = (date: Date): 'minute' | 'hourly' | 'daily' => {
    if (isToday(date)) return 'minute';
    if (date >= thirtyDaysAgo && date <= maxAvailableDate) return 'hourly';
    return 'daily';
  };

  // Handle date selection
  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    
    // Only allow selection of available dates
    if (isDateAvailable(currentMonth.getFullYear(), currentMonth.getMonth(), day)) {
      setSelectedDate(newDate);
    }
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
    setSearchedRate(null);
    try {
      const rate = await fetchRateForDateTime(selectedDate, selectedTime);
      if (rate !== null) {
        setSearchedRate(rate);
        setSearchPrecision(getDatePrecision(selectedDate));
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

          {/* Data Source and Precision Indicators */}
          {chartData.length > 0 && isRealData && (
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                Real Market Data
              </div>
              
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-blue-500/20 text-blue-400">
                <AlertCircle className="h-3 w-3" />
                {formatDataPrecision(dataPrecision, selectedTimeframe === '1D' && isToday(new Date()))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-sm text-gray-400 flex items-start gap-2">
              <span className="text-purple-400">💡</span>
              <span>
                {showDatePicker 
                  ? `Select a specific date and time to find the historical rate. Minute precision for today only, hourly precision for last 30 days, daily precision for older dates.`
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
                      {calendarDays.map((day, index) => {
                        const isAvailable = day ? isDateAvailable(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth(),
                          day
                        ) : false;
                        const isSelected = day === selectedDate.getDate() &&
                          selectedDate.getMonth() === currentMonth.getMonth() &&
                          selectedDate.getFullYear() === currentMonth.getFullYear();
                        const isTodayDate = day === today.getDate() &&
                          currentMonth.getMonth() === today.getMonth() &&
                          currentMonth.getFullYear() === today.getFullYear();
                        const precision = day && isAvailable ? 
                          getDatePrecision(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)) : 'daily';

                        return (
                          <div key={index} className="aspect-square relative">
                            {day && (
                              <>
                                <button
                                  onClick={() => handleDateSelect(day)}
                                  disabled={!isAvailable}
                                  className={`w-full h-full rounded transition-colors ${
                                    !isAvailable
                                      ? 'text-gray-600 cursor-not-allowed opacity-50'
                                      : isSelected
                                      ? 'bg-purple-600 text-white'
                                      : isTodayDate
                                      ? 'bg-gray-700 text-white border border-purple-500'
                                      : 'text-gray-300 hover:bg-gray-700'
                                  }`}
                                >
                                  {day}
                                </button>
                                {isAvailable && precision === 'daily' && (
                                  <div className="absolute top-0 right-0 w-1 h-1 bg-yellow-400 rounded-full" 
                                       title="Daily precision only" />
                                )}
                                {isAvailable && precision === 'hourly' && (
                                  <div className="absolute top-0 right-0 w-1 h-1 bg-blue-400 rounded-full" 
                                       title="Hourly precision" />
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Date availability note */}
                    <div className="mt-3 space-y-1">
                      <div className="text-xs text-gray-500">
                        Historical data available from January 2018 to {maxAvailableDate.toLocaleDateString('en-GB')}
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
                          <span>Today = Minute precision</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-400 rounded-full inline-block" />
                          <span>Blue dot = Hourly precision (last 30 days)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-yellow-400 rounded-full inline-block" />
                          <span>Yellow dot = Daily precision only (older than 30 days)</span>
                        </div>
                      </div>
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
                      {selectedDate && (
                        <div className="text-xs text-gray-500 mt-1">
                          {isToday(selectedDate)
                            ? '✓ Minute precision available (today only)' 
                            : getDatePrecision(selectedDate) === 'hourly'
                            ? '⚠ Hourly precision only (approximate time)'
                            : '⚠ Daily precision only (no time data)'}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400">
                        {isToday(selectedDate) 
                          ? 'Time (exact minute data available)'
                          : getDatePrecision(selectedDate) === 'hourly'
                          ? 'Time (will use hourly average)'
                          : 'Time - Daily rate only'}
                      </label>
                      <Input
                        type="text"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="bg-gray-900 border-gray-700 text-white"
                        placeholder="09:00"
                        disabled={getDatePrecision(selectedDate) === 'daily'}
                      />
                    </div>

                    <Button
                      onClick={handleFindRate}
                      disabled={isSearching || selectedDate > maxAvailableDate}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      {isSearching ? 'Searching...' : 'Find Rate'}
                    </Button>

                    {searchedRate !== null && (
                      <div className="bg-gray-900 rounded-lg p-3 space-y-2">
                        <div className="text-sm text-gray-400">
                          Rate Found - {formatDataPrecision(searchPrecision!)}:
                        </div>
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

          {/* Chart Container - Fixed height */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="relative" style={{ height: '350px' }}>
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-400">Loading chart data...</div>
                </div>
              ) : error && chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <div className="text-yellow-400 text-center">{error}</div>
                </div>
              ) : (
                <HistoricalChart
                  data={chartData}
                  onPriceSelect={(price: number) => {
                    onPriceSelect(price);
                    onClose();
                  }}
                  selectedPair={selectedPair}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}