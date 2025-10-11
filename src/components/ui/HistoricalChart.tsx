import React, { useRef, useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, Hand, Maximize2 } from 'lucide-react';

interface ChartDataPoint {
  date: string;
  price: number;
  timestamp: number;
}

interface HistoricalChartProps {
  data: ChartDataPoint[];
  onPriceSelect: (price: number) => void;
  selectedPair: string;
  selectedTimeframe?: string;
  width?: number;
  height?: number;
}

// Format timestamp for UK display
const formatChartDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export const HistoricalChart: React.FC<HistoricalChartProps> = ({
  data,
  onPriceSelect,
  selectedPair,
  selectedTimeframe = '1D',
  width = 800,
  height = 400
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width, height });
  
  // Zoom and pan state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragStartOffset, setDragStartOffset] = useState<{ x: number; y: number } | null>(null);

  // Update canvas size based on container width
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const isMobile = containerWidth < 768;
        
        const newWidth = containerWidth - 2;
        const newHeight = isMobile ? 250 : 350;
        
        setCanvasSize({ width: newWidth, height: newHeight });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [width, height]);

  // Responsive padding and dimensions
  const isMobile = canvasSize.width < 768;
  const padding = { 
    top: 20, 
    right: isMobile ? 40 : 60, 
    bottom: isMobile ? 30 : 40, 
    left: isMobile ? 40 : 60 
  };
  const chartWidth = canvasSize.width - padding.left - padding.right;
  const chartHeight = canvasSize.height - padding.top - padding.bottom;

  // Calculate min/max values for scaling
  const prices = data.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const priceBuffer = priceRange * 0.1;

  const minTime = data[0]?.timestamp || 0;
  const maxTime = data[data.length - 1]?.timestamp || 0;

  // Convert data coordinates to canvas coordinates with zoom and pan
  const getCanvasX = (timestamp: number): number => {
    const baseX = padding.left + ((timestamp - minTime) / (maxTime - minTime)) * chartWidth;
    return (baseX - padding.left - chartWidth / 2) * zoomLevel + chartWidth / 2 + padding.left + panOffset.x;
  };

  const getCanvasY = (price: number): number => {
    const baseY = padding.top + ((maxPrice + priceBuffer - price) / (priceRange + 2 * priceBuffer)) * chartHeight;
    return (baseY - padding.top - chartHeight / 2) * zoomLevel + chartHeight / 2 + padding.top + panOffset.y;
  };

  // Convert canvas coordinates back to data coordinates with zoom and pan
  const getTimestampFromX = (x: number): number => {
    const adjustedX = (x - padding.left - panOffset.x - chartWidth / 2) / zoomLevel + chartWidth / 2 + padding.left;
    const ratio = (adjustedX - padding.left) / chartWidth;
    return minTime + ratio * (maxTime - minTime);
  };

  // Find closest data point to mouse position
  const findClosestPoint = (mouseX: number): ChartDataPoint | null => {
    if (data.length === 0) return null;

    const targetTime = getTimestampFromX(mouseX);
    let closest = data[0];
    let minDiff = Math.abs(data[0].timestamp - targetTime);

    for (const point of data) {
      const diff = Math.abs(point.timestamp - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }

    return closest;
  };

  // Format x-axis label based on timeframe
  const formatXAxisLabel = (timestamp: number, timeframe: string): string => {
    const date = new Date(timestamp);
    
    switch(timeframe) {
      case '1D':
        return date.toLocaleTimeString('en-GB', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        });
        
      case '5D':
      case '1M':
      case '3M':
        if (isMobile) {
          return `${date.getDate()}/${date.getMonth() + 1}`;
        } else {
          return date.toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: 'short' 
          });
        }
        
      default:
        return date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short' 
        });
    }
  };

  // Determine number of x-axis labels based on timeframe
  const getTimeSteps = (timeframe: string): number => {
    switch(timeframe) {
      case '1D':
        return isMobile ? 3 : 5;
      case '5D':
        return 5;
      case '1M':
        return isMobile ? 3 : 5;
      case '3M':
        return isMobile ? 3 : 5;
      default:
        return 4;
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.2, 10)); // Max 10x zoom
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.2, 0.5)); // Min 0.5x zoom
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const togglePanMode = () => {
    setPanMode(!panMode);
  };

  // Draw the chart
  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Save context for clipping
    ctx.save();
    
    // Clip to chart area
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, chartWidth, chartHeight);
    ctx.clip();

    // Draw grid lines
    ctx.strokeStyle = '#ffffff20';
    ctx.lineWidth = 1;

    // Draw price line first (so it's behind grid in clipped area)
    ctx.strokeStyle = '#9333ea';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = getCanvasX(point.timestamp);
      const y = getCanvasY(point.price);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw data points if there aren't too many (adjusted for zoom)
    if (data.length <= 50 || zoomLevel > 2) {
      ctx.fillStyle = '#9333ea';
      data.forEach(point => {
        const x = getCanvasX(point.timestamp);
        const y = getCanvasY(point.price);
        
        // Only draw if point is visible
        if (x >= padding.left && x <= canvasSize.width - padding.right &&
            y >= padding.top && y <= canvasSize.height - padding.bottom) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }

    // Restore context (remove clipping)
    ctx.restore();

    // Draw grid lines and labels (outside clipped area)
    ctx.strokeStyle = '#ffffff20';
    ctx.lineWidth = 1;

    // Horizontal grid lines (price levels)
    const priceSteps = isMobile ? 3 : 5;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice - priceBuffer + (i / priceSteps) * (priceRange + 2 * priceBuffer);
      const y = padding.top + (i / priceSteps) * chartHeight;
      
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvasSize.width - padding.right, y);
      ctx.stroke();

      // Price labels
      ctx.fillStyle = '#C7B3FF80';
      ctx.font = `${isMobile ? 10 : 12}px system-ui`;
      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(4), padding.left - 5, y + 4);
    }

    // Vertical grid lines (time/date labels)
    const timeSteps = getTimeSteps(selectedTimeframe);
    
    for (let i = 0; i <= timeSteps; i++) {
      const ratio = i / timeSteps;
      const x = padding.left + ratio * chartWidth;
      const timestamp = minTime + ratio * (maxTime - minTime);
      
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, canvasSize.height - padding.bottom);
      ctx.stroke();

      const label = formatXAxisLabel(timestamp, selectedTimeframe);
      
      ctx.fillStyle = '#C7B3FF80';
      ctx.font = `${isMobile ? 10 : 12}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText(label, x, canvasSize.height - padding.bottom + 20);
    }

    // Draw crosshair and tooltip if mouse is hovering and not panning
    if (mousePos && hoveredPoint && !isPanning) {
      const pointX = getCanvasX(hoveredPoint.timestamp);
      const pointY = getCanvasY(hoveredPoint.price);

      // Only draw if point is visible
      if (pointX >= padding.left && pointX <= canvasSize.width - padding.right &&
          pointY >= padding.top && pointY <= canvasSize.height - padding.bottom) {
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(padding.left, padding.top, chartWidth, chartHeight);
        ctx.clip();

        // Crosshair lines
        ctx.strokeStyle = '#ffffff60';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(pointX, padding.top);
        ctx.lineTo(pointX, canvasSize.height - padding.bottom);
        ctx.stroke();

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(padding.left, pointY);
        ctx.lineTo(canvasSize.width - padding.right, pointY);
        ctx.stroke();

        ctx.setLineDash([]);

        // Highlight point
        ctx.fillStyle = '#9333ea';
        ctx.beginPath();
        ctx.arc(pointX, pointY, 4, 0, 2 * Math.PI);
        ctx.fill();

        ctx.restore();

        // Tooltip
        const tooltipText = `${formatChartDate(hoveredPoint.timestamp)} - ${hoveredPoint.price.toFixed(4)}`;
        ctx.font = `${isMobile ? 12 : 14}px system-ui`;
        ctx.fillStyle = '#ffffff';
        
        const textMetrics = ctx.measureText(tooltipText);
        const tooltipWidth = textMetrics.width + 16;
        const tooltipHeight = 24;
        
        let tooltipX = mousePos.x + 10;
        let tooltipY = mousePos.y - 30;

        if (tooltipX + tooltipWidth > canvasSize.width) tooltipX = mousePos.x - tooltipWidth - 10;
        if (tooltipY < 0) tooltipY = mousePos.y + 30;

        // Tooltip background
        ctx.fillStyle = '#1f1827';
        ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        ctx.strokeStyle = '#9333ea';
        ctx.lineWidth = 1;
        ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

        // Tooltip text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(tooltipText, tooltipX + 8, tooltipY + 16);
      }
    }
  };

  // Handle mouse movement
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setMousePos({ x, y });

    if (panMode && isPanning && dragStart && dragStartOffset) {
      // Calculate pan offset
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      setPanOffset({
        x: dragStartOffset.x + dx,
        y: dragStartOffset.y + dy
      });
    } else if (!panMode) {
      // Only show crosshair if mouse is within chart area and not in pan mode
      if (x >= padding.left && x <= canvasSize.width - padding.right && 
          y >= padding.top && y <= canvasSize.height - padding.bottom) {
        const closestPoint = findClosestPoint(x);
        setHoveredPoint(closestPoint);
      } else {
        setHoveredPoint(null);
      }
    }
  };

  // Handle mouse down for panning
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (panMode) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      setIsPanning(true);
      setDragStart({ x, y });
      setDragStartOffset(panOffset);
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsPanning(false);
    setDragStart(null);
    setDragStartOffset(null);
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setMousePos(null);
    setHoveredPoint(null);
    setIsPanning(false);
    setDragStart(null);
    setDragStartOffset(null);
  };

  // Handle click to select price
  const handleClick = () => {
    if (!panMode && hoveredPoint) {
      onPriceSelect(hoveredPoint.price);
    }
  };

  // Redraw chart when data changes or mouse moves
  useEffect(() => {
    drawChart();
  }, [data, mousePos, hoveredPoint, canvasSize, selectedTimeframe, zoomLevel, panOffset, isPanning]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`rounded-lg w-full h-full ${panMode ? 'cursor-grab' : 'cursor-crosshair'} ${isPanning ? 'cursor-grabbing' : ''}`}
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Pair label with timeframe */}
      <div className={`absolute top-4 left-4 text-purple-300 font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>
        {selectedPair} - {selectedTimeframe}
      </div>
      
      {/* Zoom and pan controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={togglePanMode}
          className={`p-2 rounded-lg transition-colors ${
            panMode 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-800/80 text-purple-300 hover:bg-gray-700/80'
          }`}
          title="Toggle pan mode"
        >
          <Hand className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomIn}
          className="p-2 bg-gray-800/80 text-purple-300 rounded-lg hover:bg-gray-700/80 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-gray-800/80 text-purple-300 rounded-lg hover:bg-gray-700/80 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 bg-gray-800/80 text-purple-300 rounded-lg hover:bg-gray-700/80 transition-colors"
          title="Reset view"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
      
      {/* Click instruction */}
      {hoveredPoint && !panMode && (
        <div className={`absolute bottom-14 right-4 text-purple-300 ${isMobile ? 'text-xs' : 'text-sm'}`}>
          Click to select rate
        </div>
      )}
      
      {/* Pan mode indicator */}
      {panMode && (
        <div className={`absolute bottom-14 right-4 text-purple-300 ${isMobile ? 'text-xs' : 'text-sm'}`}>
          Drag to pan, click hand to exit
        </div>
      )}
    </div>
  );
};