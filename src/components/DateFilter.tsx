import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Calendar, X } from 'lucide-react';

interface DateFilterProps {
  onApplyFilter: (startDate: Date, endDate: Date) => void;
  onClearFilter: () => void;
}

export default function DateFilter({ onApplyFilter, onClearFilter }: DateFilterProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const applyPreset = (preset: string) => {
    const end = new Date();
    const start = new Date();
    
    switch(preset) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }
    
    onApplyFilter(start, end);
    setShowCustom(false);
  };

  const applyCustom = () => {
    if (startDate && endDate) {
      onApplyFilter(new Date(startDate), new Date(endDate));
      setShowCustom(false);
    }
  };

  return (
    <Card className="bg-gray-900/50 border-gray-800 mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-400" />
            <span className="text-white font-semibold">Date Range</span>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => applyPreset('today')}
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Today
            </Button>
            <Button
              onClick={() => applyPreset('week')}
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Last 7 Days
            </Button>
            <Button
              onClick={() => applyPreset('month')}
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Last Month
            </Button>
            <Button
              onClick={() => applyPreset('quarter')}
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Last Quarter
            </Button>
            <Button
              onClick={() => setShowCustom(!showCustom)}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              Custom Range
            </Button>
            <Button
              onClick={onClearFilter}
              size="sm"
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-900/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {showCustom && (
          <div className="mt-4 pt-4 border-t border-gray-700 flex items-end gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
              />
            </div>
            <Button
              onClick={applyCustom}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Apply
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}