import React, { useRef, useEffect, useState } from 'react';
import { type ChartDataPoint, formatChartDate } from '../../constants/mockChartData';

interface HistoricalChartProps {
  data: ChartDataPoint[];
  onPriceSelect: (price: number) => void;
  selectedPair: string;
  width?: number;
  height?: number;
}

export const HistoricalChart: React.FC<HistoricalChartProps> = ({
  data,
  onPriceSelect,
  selectedPair,
  width = 800,
  height = 400
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width, height });

  // Update canvas size based on container width
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const isMobile = containerWidth < 768;
        
        const newWidth = Math.min(containerWidth - 32, width); // 32px for padding
        const newHeight = isMobile ? Math.max(250, newWidth * 0.6) : height;
        
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
  const priceBuffer = priceRange * 0.1; // 10% buffer

  const minTime = data[0]?.timestamp || 0;
  const maxTime = data[data.length - 1]?.timestamp || 0;

  // Convert data coordinates to canvas coordinates
  const getCanvasX = (timestamp: number): number => {
    return padding.left + ((timestamp - minTime) / (maxTime - minTime)) * chartWidth;
  };

  const getCanvasY = (price: number): number => {
    return padding.top + ((maxPrice + priceBuffer - price) / (priceRange + 2 * priceBuffer)) * chartHeight;
  };

  // Convert canvas coordinates back to data coordinates
  const getTimestampFromX = (x: number): number => {
    const ratio = (x - padding.left) / chartWidth;
    return minTime + ratio * (maxTime - minTime);
  };

  // Convert canvas Y coordinate to price value (for future price-based interactions)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-ignore
const getPriceFromY = (y: number): number => {
  const ratio = (y - padding.top) / chartHeight;
  return (maxPrice + priceBuffer) - ratio * (priceRange + 2 * priceBuffer);
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

  // Draw the chart
  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Set up styling
    ctx.fillStyle = '#10051A';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw grid lines
    ctx.strokeStyle = '#ffffff20';
    ctx.lineWidth = 1;

    // Horizontal grid lines (price levels)
    const priceSteps = isMobile ? 3 : 5;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice - priceBuffer + (i / priceSteps) * (priceRange + 2 * priceBuffer);
      const y = getCanvasY(price);
      
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

    // Draw price line
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

    // Draw crosshair and tooltip if mouse is hovering
    if (mousePos && hoveredPoint) {
      const pointX = getCanvasX(hoveredPoint.timestamp);
      const pointY = getCanvasY(hoveredPoint.price);

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

      // Tooltip
      const tooltipText = `${formatChartDate(hoveredPoint.timestamp)} - ${hoveredPoint.price.toFixed(4)}`;
      ctx.font = `${isMobile ? 12 : 14}px system-ui`;
      ctx.fillStyle = '#ffffff';
      
      const textMetrics = ctx.measureText(tooltipText);
      const tooltipWidth = textMetrics.width + 16;
      const tooltipHeight = 24;
      
      let tooltipX = mousePos.x + 10;
      let tooltipY = mousePos.y - 30;

      // Keep tooltip within canvas bounds
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
  };

  // Handle mouse movement
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setMousePos({ x, y });

    // Only show crosshair if mouse is within chart area
    if (x >= padding.left && x <= canvasSize.width - padding.right && 
        y >= padding.top && y <= canvasSize.height - padding.bottom) {
      const closestPoint = findClosestPoint(x);
      setHoveredPoint(closestPoint);
    } else {
      setHoveredPoint(null);
    }
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setMousePos(null);
    setHoveredPoint(null);
  };

  // Handle click to select price
  const handleClick = () => {
    if (hoveredPoint) {
      onPriceSelect(hoveredPoint.price);
    }
  };

  // Redraw chart when data changes or mouse moves
  useEffect(() => {
    drawChart();
  }, [data, mousePos, hoveredPoint, canvasSize]);

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="cursor-crosshair border border-white/20 rounded-lg max-w-full"
        style={{ backgroundColor: '#10051A' }}
      />
      
      {/* Pair label */}
      <div className={`absolute top-4 left-4 text-purple-300 font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>
        {selectedPair}
      </div>
      
      {/* Click instruction */}
      {hoveredPoint && (
        <div className={`absolute bottom-4 right-4 text-purple-300 ${isMobile ? 'text-xs' : 'text-sm'}`}>
          Click to select rate
        </div>
      )}
    </div>
  );
};