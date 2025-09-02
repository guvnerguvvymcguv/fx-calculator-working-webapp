import React, { useState } from 'react';
import { X, Calendar, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { HistoricalChart } from './HistoricalChart';
import { type ChartDataPoint, TIMEFRAMES, MOCK_CHART_DATA, getPriceAtTime } from '../../constants/mockChartData';

interface HistoricalRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPriceSelect: (price: number) => void;
  chartData: ChartDataPoint[];
  selectedPair: string;
  availablePairs: string[];
  selectedTimeframe: string;
  onPairChange: (pair: string) => void;
  onTimeframeChange: (timeframe: string) => void;
}

export const HistoricalRateModal: React.FC<HistoricalRateModalProps> = ({
  isOpen,
  onClose,
  onPriceSelect,
  chartData,
  selectedPair,
  availablePairs,
  selectedTimeframe,
  onPairChange,
  onTimeframeChange
}) => {
  // New state for date/time picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeInput, setTimeInput] = useState('');
  const [searchedRate, setSearchedRate] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [customChartData, setCustomChartData] = useState<ChartDataPoint[] | null>(null);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);

  if (!isOpen) return null;

  const handlePriceSelect = (price: number) => {
    onPriceSelect(price);
    onClose(); // Close modal after selection
  };

  // Helper function to get data centered around a specific date
  const getDataAroundDate = (targetTimestamp: number, days: number, pairName: string): ChartDataPoint[] => {
    const fullData = MOCK_CHART_DATA[pairName] || [];
    const halfDays = Math.floor(days / 2);
    const startTime = targetTimestamp - (halfDays * 24 * 60 * 60 * 1000);
    const endTime = targetTimestamp + (halfDays * 24 * 60 * 60 * 1000);
    
    return fullData.filter(point => 
      point.timestamp >= startTime && point.timestamp <= endTime
    );
  };

  // Reset function to clear custom selections
  const handleReset = () => {
    setCustomChartData(null);
    setSelectedDate(null);
    setTimeInput('');
    setSearchedRate(null);
    setSelectedTimestamp(null);
  };

  // Handle pair change - update custom data if we have a selected timestamp
  const handlePairChange = (pair: string) => {
    onPairChange(pair);
    
    // If we have a custom timestamp selected, update the custom data for the new pair
    if (selectedTimestamp) {
      const centeredData = getDataAroundDate(selectedTimestamp, 5, pair);
      setCustomChartData(centeredData);
      
      // Update the searched rate for the new pair
      const fullData = MOCK_CHART_DATA[pair] || [];
      const closestPoint = getPriceAtTime(fullData, selectedTimestamp);
      if (closestPoint) {
        setSearchedRate(closestPoint.price);
      }
    }
  };

  // Handle timeframe change - clear custom data if not 5D
  const handleTimeframeChange = (timeframe: string) => {
    onTimeframeChange(timeframe);
    
    // If manually changing timeframe (and it's not 5D), clear custom data
    if (timeframe !== '5D') {
      setCustomChartData(null);
    }
  };

  // Handle date/time search
  const handleDateTimeSearch = () => {
    if (!selectedDate || !timeInput) return;

    // Parse time input (supports both 12 and 24 hour formats)
    const timeRegex = /^(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?$/;
    const timeMatch = timeInput.match(timeRegex);
    
    if (!timeMatch) {
      alert('Please enter a valid time format (e.g., 13:00, 1:00 PM, or 1pm)');
      return;
    }

    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2] || '0');
    const period = timeMatch[3]?.toLowerCase();

    // Convert to 24-hour format
    if (period === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }

    // Create target timestamp
    const targetDate = new Date(selectedDate);
    targetDate.setHours(hours, minutes, 0, 0);
    const targetTimestamp = targetDate.getTime();

    // Get full dataset for the selected pair (not filtered by timeframe)
    const fullData = MOCK_CHART_DATA[selectedPair] || [];
    
    // Find closest price point
    const closestPoint = getPriceAtTime(fullData, targetTimestamp);
    
    if (closestPoint) {
      setSearchedRate(closestPoint.price);
      setSelectedTimestamp(targetTimestamp);
      
      // Switch to weekly view and center on the searched date
      onTimeframeChange('5D');
      
      // Set custom chart data centered around the searched date
      const centeredData = getDataAroundDate(targetTimestamp, 5, selectedPair);
      setCustomChartData(centeredData);
      
      // Keep date picker open - remove this line: setShowDatePicker(false);
    } else {
      alert('No data available for the selected date/time');
    }
  };

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-[#10051A] border border-white/20 rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <h2 className="text-xl font-bold text-purple-200">
            Historical Exchange Rates
          </h2>
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="border-white/20 text-purple-200 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Controls */}
        <div className="p-6 border-b border-white/20">
          <div className="flex flex-wrap items-center gap-4">
            {/* Currency Pair Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-purple-200">
                Pair:
              </label>
              <div className="flex gap-1">
                {availablePairs.map((pair) => (
                  <button
                    key={pair}
                    onClick={() => handlePairChange(pair)}
                    className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                      selectedPair === pair
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/10 text-purple-200 hover:bg-white/20'
                    }`}
                  >
                    {pair.slice(0, 3)}/{pair.slice(3)}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-purple-200">
                Timeframe:
              </label>
              <div className="flex gap-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.label}
                    onClick={() => handleTimeframeChange(tf.label)}
                    className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                      selectedTimeframe === tf.label
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/10 text-purple-200 hover:bg-white/20'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* NEW: Calendar Button */}
            <div className="flex items-center gap-2 ml-4">
              <Button
                onClick={() => setShowDatePicker(!showDatePicker)}
                variant="outline"
                size="sm"
                className="border-white/20 text-purple-200 hover:bg-white/10"
              >
                <Calendar className="h-4 w-4 mr-1" />
                Date/Time Search
              </Button>
              
              {/* Reset Button - only show if custom data is active */}
              {customChartData && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  size="sm"
                  className="border-red-500/20 text-red-300 hover:bg-red-500/10"
                >
                  Reset View
                </Button>
              )}
            </div>
          </div>

          {/* NEW: Date/Time Picker */}
          {showDatePicker && (
            <div className="mt-4 p-4 bg-white/5 border border-white/20 rounded-lg">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Calendar */}
                <div>
                  <h4 className="text-sm font-medium text-purple-200 mb-3">Select Date</h4>
                  
                  {/* Month Navigation */}
                  <div className="flex items-center justify-between mb-3">
                    <Button
                      onClick={() => navigateMonth('prev')}
                      variant="ghost"
                      size="sm"
                      className="text-purple-200 hover:bg-white/10"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-purple-200 font-medium">
                      {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </span>
                    <Button
                      onClick={() => navigateMonth('next')}
                      variant="ghost"
                      size="sm"
                      className="text-purple-200 hover:bg-white/10"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1 text-xs">
                    {/* Day headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="p-2 text-center text-purple-300 font-medium">
                        {day}
                      </div>
                    ))}
                    
                    {/* Calendar days */}
                    {generateCalendarDays().map((day, index) => (
                      <div key={index} className="relative">
                        {day ? (
                          <button
                            onClick={() => handleDateSelect(day)}
                            className={`w-full p-2 text-center rounded transition-colors ${
                              selectedDate && 
                              selectedDate.getDate() === day && 
                              selectedDate.getMonth() === currentMonth.getMonth() &&
                              selectedDate.getFullYear() === currentMonth.getFullYear()
                                ? 'bg-purple-600 text-white'
                                : 'text-purple-200 hover:bg-white/10'
                            }`}
                          >
                            {day}
                          </button>
                        ) : (
                          <div className="p-2"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Time Input and Search */}
                <div>
                  <h4 className="text-sm font-medium text-purple-200 mb-3">Time & Search</h4>
                  
                  {selectedDate && (
                    <div className="mb-3 p-2 bg-purple-600/10 rounded border border-purple-600/20">
                      <div className="text-xs text-purple-300">Selected Date:</div>
                      <div className="text-sm text-purple-200 font-medium">
                        {formatDateDisplay(selectedDate)}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-purple-300 mb-1">
                        Time (e.g., 13:00, 1:00 PM, 1pm)
                      </label>
                      <input
                        type="text"
                        value={timeInput}
                        onChange={(e) => setTimeInput(e.target.value)}
                        placeholder="13:00"
                        className="w-full p-2 bg-white/10 border border-white/20 rounded text-purple-200 placeholder-purple-400"
                      />
                    </div>

                    <Button
                      onClick={handleDateTimeSearch}
                      disabled={!selectedDate || !timeInput}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Search className="h-4 w-4 mr-1" />
                      Find Rate
                    </Button>

                    {/* Display searched rate */}
                    {searchedRate && (
                      <div className="mt-3 p-3 bg-green-600/10 border border-green-600/20 rounded">
                        <div className="text-xs text-green-300 mb-1">Rate Found:</div>
                        <div className="text-lg font-bold text-green-400">{searchedRate.toFixed(4)}</div>
                        <Button
                          onClick={() => handlePriceSelect(searchedRate)}
                          size="sm"
                          className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white"
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

          {/* Instructions */}
          <div className="mt-4 p-3 bg-purple-600/10 rounded-lg border border-purple-600/20">
            <p className="text-sm text-purple-300">
              💡 <strong>How to use:</strong> Use the Date/Time Search for specific rates, or hover over the chart to see historical rates and click on any point to select that rate for your calculation.
            </p>
          </div>
        </div>

        {/* Chart Container */}
        <div className="p-6 flex justify-center">
          <div className="w-full max-w-4xl">
            <HistoricalChart
              data={customChartData || chartData}
              onPriceSelect={handlePriceSelect}
              selectedPair={selectedPair}
              width={800}
              height={400}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/20 bg-white/5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-purple-300">
              Showing {(customChartData || chartData).length} data points for {selectedPair.slice(0, 3)}/{selectedPair.slice(3)} ({selectedTimeframe})
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              className="border-white/20 text-purple-200 hover:bg-white/10"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};