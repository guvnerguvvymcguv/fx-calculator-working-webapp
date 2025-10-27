import { useState } from 'react';
import { X, Calendar, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { HistoricalChart } from './HistoricalChart';
import { useHistoricalRates } from '../../hooks/useHistoricalRates';

interface MockHistoricalRatesProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MockHistoricalRates({ isOpen, onClose }: MockHistoricalRatesProps) {
  if (!isOpen) return null;

  const [selectedPair] = useState('GBPUSD');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTime] = useState('09:00');
  const [searchedRate] = useState<number>(1.3304);

  // Use real historical rates hook for actual chart data
  const {
    chartData,
    isLoading,
    error,
    isRealData
  } = useHistoricalRates('GBPUSD');

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

  // Date range for availability
  const dataDateRange = {
    min: new Date('2024-10-01'),
    max: new Date('2025-10-26')
  };

  const isDateAvailable = (year: number, month: number, day: number): boolean => {
    const checkDate = new Date(year, month, day);
    const checkDateOnly = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
    const minDateOnly = new Date(dataDateRange.min.getFullYear(), dataDateRange.min.getMonth(), dataDateRange.min.getDate());
    const maxDateOnly = new Date(dataDateRange.max.getFullYear(), dataDateRange.max.getMonth(), dataDateRange.max.getDate());
    
    return checkDateOnly >= minDateOnly && checkDateOnly <= maxDateOnly;
  };

  // Handle date selection (visual only, non-functional)
  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    if (isDateAvailable(currentMonth.getFullYear(), currentMonth.getMonth(), day)) {
      setSelectedDate(newDate);
    }
  };

  // Handle month navigation (non-functional)
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const today = new Date();

  // Mock price select handler (does nothing)
  const handlePriceSelect = () => {
    // Non-functional for landing page mock
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="backdrop-blur-md border border-white/20 rounded-xl shadow-xl hover:border-white/30 transition-all duration-300 w-full max-w-5xl max-h-[90vh] overflow-auto" style={{ color: '#C7B3FF', backgroundColor: '#291e31' }}>
        {/* Header */}
        <div className="p-6 border-b border-white/20 flex items-center justify-between">
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
            {/* Currency Pair Dropdown - Non-clickable display */}
            <div className="flex items-center gap-2">
              <span className="text-gray-300">Pair:</span>
              <div className="w-32 bg-white/10 border-white/20 hover:border-white/40 text-purple-100 transition-colors duration-200 px-3 py-2 rounded-lg cursor-not-allowed opacity-75">
                GBP/USD
              </div>
            </div>

            {/* Timeframe Buttons - Non-clickable, locked to 1M */}
            <div className="flex items-center gap-2">
              <span className="text-gray-300">Timeframe:</span>
              <div className="flex gap-1">
                {['1D', '5D', '1M', '3M'].map((tf) => (
                  <div
                    key={tf}
                    className={tf === '1M'
                      ? 'px-3 py-2 rounded-lg text-sm font-semibold bg-purple-600 text-white shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] cursor-not-allowed'
                      : 'px-3 py-2 rounded-lg text-sm text-purple-200 border-white/10 border opacity-50 cursor-not-allowed'}
                  >
                    {tf}
                  </div>
                ))}
              </div>
            </div>

            {/* Date/Time Search Button - Visual only */}
            <div className="px-4 py-2 rounded-lg bg-white/10 border-white/20 text-purple-100 flex items-center gap-2 cursor-not-allowed opacity-75">
              <Calendar className="h-4 w-4" />
              Date/Time Search
            </div>
          </div>

          {/* Data Source Indicators */}
          {chartData.length > 0 && isRealData && (
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400 border border-green-500/30 hover:border-green-500/50 transition-colors duration-200">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                Real Market Data
              </div>
              
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:border-blue-500/50 transition-colors duration-200">
                30-minute precision
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="border border-white/20 hover:border-white/40 rounded-lg p-3 transition-colors duration-200" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <p className="text-sm text-gray-400 flex items-start gap-2">
              <span className="text-purple-400">💡</span>
              <span>
                Use the Date/Time Search for specific rates, or hover over the chart to see historical rates and click on any point to select that rate for your calculation.
              </span>
            </p>
          </div>

          {/* Chart Container */}
          <div className="bg-white/10 border-white/20 hover:border-white/40 rounded-lg p-4 transition-colors duration-200">
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
                  onPriceSelect={handlePriceSelect}
                  selectedPair={selectedPair}
                  selectedTimeframe="1M"
                />
              )}
            </div>
          </div>

          {/* Date/Time Picker Section */}
          <div className="border border-white/20 hover:border-white/40 rounded-lg p-4 space-y-4 transition-colors duration-200" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Calendar */}
              <div>
                <h3 className="text-gray-300 mb-2">Select Date</h3>
                <div className="bg-gray-950/50 border border-white/0 rounded-lg p-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
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

                      return (
                        <div key={index} className="aspect-square relative">
                          {day && (
                            <button
                              onClick={() => handleDateSelect(day)}
                              disabled={!isAvailable}
                              className={`w-full h-full rounded transition-colors ${
                                !isAvailable
                                  ? 'text-gray-600 cursor-not-allowed opacity-50'
                                  : isSelected
                                  ? 'bg-purple-600 text-white font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] cursor-default'
                                  : isTodayDate
                                  ? 'bg-gray-700 text-white border border-purple-500'
                                  : 'text-gray-300 hover:bg-gray-700'
                              }`}
                            >
                              {day}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Date availability note */}
                  <div className="mt-3 text-xs text-gray-500">
                    Historical data available from {dataDateRange.min.toLocaleDateString('en-GB')} to {dataDateRange.max.toLocaleDateString('en-GB')}
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
                    <div className="text-xs text-gray-500 mt-1">
                      Searching for minute-precise data at your specified time
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400">
                      Time (24-hour format)
                    </label>
                    <Input
                      type="text"
                      value={selectedTime}
                      readOnly
                      className="bg-gray-950/50 border border-white/0 hover:border-white/20 focus:border-white/40 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-200 outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 rounded-lg placeholder-gray-500 cursor-not-allowed opacity-75"
                      placeholder="09:00"
                    />
                  </div>

                  <Button
                    disabled
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] opacity-75 cursor-not-allowed"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Find Rate
                  </Button>

                  {/* Mock Rate Found Display */}
                  <div className="bg-gray-900 rounded-lg p-3 space-y-2">
                    <div className="text-sm text-gray-400">
                      Rate Found:
                    </div>
                    <div className="text-2xl font-bold text-green-400">
                      {searchedRate.toFixed(4)}
                    </div>
                    <Button
                      disabled
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] opacity-75 cursor-not-allowed"
                    >
                      Use This Rate
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
