// PDF Generation with jsPDF
// Creates professional SpreadChecker-branded client reports

import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';

// SpreadChecker Brand Colors - Updated to match website
const COLORS = {
  background: [16, 5, 26] as [number, number, number],        // #10051A - Dark purple/black background
  primary: [139, 92, 246] as [number, number, number],        // #8B5CF6 - Vibrant purple (matches website)
  text: [255, 255, 255] as [number, number, number],          // #ffffff - White text
  textSecondary: [224, 224, 224] as [number, number, number], // #e0e0e0 - Light gray
  textMuted: [156, 163, 175] as [number, number, number],     // #9ca3af - Muted gray
  accent: [16, 185, 129] as [number, number, number],         // #10b981 - Green for savings
  glassBg: [26, 11, 46] as [number, number, number],          // #1a0b2e - Semi-transparent dark purple for glass effect
  glassBorder: [139, 92, 246] as [number, number, number],    // #8B5CF6 - Purple border for glass containers
  divider: [75, 85, 99] as [number, number, number],          // #4b5563 - Dark gray divider
};

interface PDFData {
  companyName: string;
  monthName: string;
  summary: {
    totalClients: number;
    totalCalculations: number;
    combinedMonthlySavings: number;
    combinedAnnualSavings: number;
    currencyPairDistribution: { [pair: string]: number };
  };
  clients: Array<{
    clientName: string;
    broker: string;
    calculations: any[];
    stats: {
      totalCalculations: number;
      currencyPairs: { [pair: string]: number };
      tradesPerYear: number;
      tradesPerMonth: number;
      avgTradeValue: number;
      monthlyTradeVolume: number;
      avgSavingsPerTrade: number;
      combinedAnnualSavings: number;
      avgPercentageSavings: number;
      avgPips: number;
    };
  }>;
}

/**
 * Add dark background to the current page
 * jsPDF doesn't support page background color, so we draw a filled rectangle
 */
function addDarkBackground(doc: jsPDF) {
  doc.setFillColor(...COLORS.background);
  doc.rect(0, 0, 210, 297, 'F'); // A4 dimensions in mm
}

/**
 * Draw a glassmorphic container
 * Since jsPDF doesn't support backdrop-filter, we simulate the glass effect with:
 * - Semi-transparent dark background
 * - Subtle purple border
 * - Rounded corners (simulated with border)
 *
 * @param doc - jsPDF document
 * @param x - X position
 * @param y - Y position
 * @param width - Container width
 * @param height - Container height
 * @param opacity - Opacity level (0-1), default 0.7
 */
function drawGlassmorphicBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number = 0.7
) {
  // Save current state
  const currentFillColor = doc.getFillColor();
  const currentDrawColor = doc.getDrawColor();

  // Draw semi-transparent background (glassmorphic effect)
  // Note: jsPDF doesn't support transparency, so we use a darker shade to simulate it
  doc.setFillColor(...COLORS.glassBg);
  doc.roundedRect(x, y, width, height, 3, 3, 'F'); // 3mm radius for rounded corners

  // Draw subtle purple border
  doc.setDrawColor(...COLORS.glassBorder);
  doc.setLineWidth(0.3); // Thin border
  doc.roundedRect(x, y, width, height, 3, 3, 'S'); // 3mm radius for rounded corners

  // Restore previous colors
  doc.setFillColor(currentFillColor);
  doc.setDrawColor(currentDrawColor);
  doc.setLineWidth(0.2); // Reset line width
}

export async function generatePDF(data: PDFData): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Page 1: Cover & Summary
  addDarkBackground(doc);
  addCoverPage(doc, data);

  // Pages 2+: Per-client breakdowns
  data.clients.forEach((client, index) => {
    doc.addPage();
    addDarkBackground(doc);
    addClientPage(doc, client, data.monthName, index);
  });

  // Convert to Uint8Array
  const pdfBlob = doc.output('arraybuffer');
  return new Uint8Array(pdfBlob);
}

function addCoverPage(doc: jsPDF, data: PDFData) {
  // Header - SpreadChecker branding
  doc.setFont('helvetica', 'bold'); // Bold font for title
  doc.setFontSize(32);
  doc.setTextColor(...COLORS.text); // White text for main title
  doc.text('SPREAD CHECKER', 20, 30);

  doc.setFont('helvetica', 'bold'); // Bold for subtitle
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.text); // White text
  doc.text('Client Data Report', 20, 45);

  doc.setFont('helvetica', 'normal'); // Regular font for metadata
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textSecondary); // Light gray for metadata
  doc.text(`Period: ${data.monthName}`, 20, 55);
  doc.text(`Company: ${data.companyName}`, 20, 62);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 20, 69);

  // MONTHLY SUMMARY - Glassmorphic container
  const summaryBoxY = 80;
  const summaryBoxHeight = 60;
  drawGlassmorphicBox(doc, 15, summaryBoxY, 180, summaryBoxHeight);

  // Summary content (with padding inside glass box)
  const boxY = summaryBoxY + 10; // Add top padding
  doc.setFont('helvetica', 'bold'); // Bold for section header
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary); // Vibrant purple for headers
  doc.text('MONTHLY SUMMARY', 20, boxY);

  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textMuted); // Muted gray for labels
  doc.text('Clients with Activity:', 25, boxY + 12);
  doc.setTextColor(...COLORS.text); // White for values
  doc.text(data.summary.totalClients.toString(), 90, boxY + 12);

  doc.setTextColor(...COLORS.textMuted);
  doc.text('Total Calculations:', 25, boxY + 20);
  doc.setTextColor(...COLORS.text);
  doc.text(data.summary.totalCalculations.toString(), 90, boxY + 20);

  doc.setTextColor(...COLORS.textMuted);
  doc.text('Combined Monthly Savings:', 25, boxY + 28);
  doc.setTextColor(...COLORS.accent); // Green for savings amounts
  doc.text(
    `£${data.summary.combinedMonthlySavings.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    90,
    boxY + 28
  );

  doc.setTextColor(...COLORS.textMuted);
  doc.text('Combined Annual Savings:', 25, boxY + 36);
  doc.setTextColor(...COLORS.accent);
  doc.text(
    `£${data.summary.combinedAnnualSavings.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    90,
    boxY + 36
  );

  // CURRENCY PAIR DISTRIBUTION - Glassmorphic container
  const pairBoxY = summaryBoxY + summaryBoxHeight + 10; // 10mm space after summary box
  const sortedPairs = Object.entries(data.summary.currencyPairDistribution)
    .sort(([, a], [, b]) => b - a);

  const pairBoxHeight = Math.max(40, sortedPairs.length * 7 + 25); // Dynamic height based on pairs
  drawGlassmorphicBox(doc, 15, pairBoxY, 180, pairBoxHeight);

  // Currency pair content (with padding inside glass box)
  const pairY = pairBoxY + 10; // Add top padding
  doc.setFont('helvetica', 'bold'); // Bold for section header
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary); // Vibrant purple for headers
  doc.text('CURRENCY PAIR DISTRIBUTION', 20, pairY);

  let pairTextY = pairY + 12;
  doc.setFont('helvetica', 'normal'); // Regular font for content
  doc.setFontSize(10);
  sortedPairs.forEach(([pair, count]) => {
    const percentage = ((count / data.summary.totalCalculations) * 100).toFixed(1);
    doc.setTextColor(...COLORS.textMuted); // Muted gray for labels
    doc.text(`${pair}:`, 25, pairTextY);
    doc.setTextColor(...COLORS.text); // White for values
    doc.text(`${count} calculations (${percentage}%)`, 50, pairTextY);
    pairTextY += 7;
  });
}

/**
 * Helper function to draw a divider line between sections
 */
function drawDividerLine(doc: jsPDF, x: number, y: number, width: number) {
  doc.setDrawColor(139, 92, 246); // Purple color with reduced opacity effect
  doc.setLineWidth(0.2);
  doc.line(x, y, x + width, y);
}

function addClientPage(doc: jsPDF, client: any, monthName: string, pageIndex: number) {
  // Box dimensions - equal padding top and bottom
  const containerStartY = 15;
  const containerPadding = 8; // Equal padding all sides (24px ≈ 8mm)
  const contentX = 18; // Left margin for content (inside container with padding)
  const indentX = 23; // Indented content

  // Draw the main glassmorphic container for the entire client section
  // Height adjusted to fit content with equal padding
  drawGlassmorphicBox(doc, 10, containerStartY, 190, 140);

  // Content starts with padding inside the container
  let yPos = containerStartY + containerPadding + 2; // Extra 2mm for better centering

  // Client header (Company name)
  doc.setFont('helvetica', 'bold'); // Bold for company name
  doc.setFontSize(24); // Larger font for company names
  doc.setTextColor(...COLORS.primary); // Vibrant purple for client name
  doc.text(client.clientName.toUpperCase(), contentX, yPos);

  yPos += 10;
  doc.setFont('helvetica', 'normal'); // Regular font for metadata
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textSecondary); // Light gray for broker
  doc.text(`Broker: ${client.broker}`, contentX, yPos);

  // Add spacing before SUMMARY section
  yPos += 12;

  // SUMMARY section (renamed from TRADING PROFILE and MONTHLY SUMMARY)
  doc.setFont('helvetica', 'bold'); // Bold for section headers
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary); // Vibrant purple for headers
  doc.text('SUMMARY', contentX, yPos);

  yPos += 8; // Space after header

  // Currency Pairs Traded
  doc.setFont('helvetica', 'normal'); // Regular font for content
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text); // White for labels
  doc.text('Currency Pairs Traded:', indentX, yPos);

  yPos += 6;
  const sortedPairs = Object.entries(client.stats.currencyPairs)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  doc.setFontSize(11);
  sortedPairs.forEach(([pair, count]) => {
    const percentage = ((count as number / client.stats.totalCalculations) * 100).toFixed(1);
    doc.setTextColor(...COLORS.text); // White for values
    doc.text(`  ${pair}: ${count} calculations (${percentage}%)`, indentX, yPos);
    yPos += 5;
  });

  yPos += 4;

  // Two-column layout for stats
  const col1X = indentX;
  const col2X = 110;

  // Row 1: Trades Per Year | Combined Annual Savings
  doc.setTextColor(...COLORS.text);
  doc.text(
    `Trades Per Year: ${client.stats.tradesPerYear}`,
    col1X,
    yPos
  );
  doc.text(
    `Combined Annual Savings: £${client.stats.combinedAnnualSavings.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    col2X,
    yPos
  );

  yPos += 6;

  // Row 2: Trades Per Month | Average Trade Value
  doc.text(
    `Trades Per Month: ~${client.stats.tradesPerMonth}`,
    col1X,
    yPos
  );
  doc.text(
    `Average Trade Value: £${client.stats.avgTradeValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
    col2X,
    yPos
  );

  yPos += 6;

  // Row 3: Monthly Trade Volume | Average Savings Per Trade
  doc.text(
    `Monthly Trade Volume: ~£${client.stats.monthlyTradeVolume.toLocaleString('en-GB', {
      maximumFractionDigits: 0,
    })}`,
    col1X,
    yPos
  );
  doc.text(
    `Average Savings Per Trade: £${client.stats.avgSavingsPerTrade.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    col2X,
    yPos
  );

  yPos += 6;

  // Row 4: Average % Savings | Average PIPs
  doc.text(
    `Average % Savings: ${client.stats.avgPercentageSavings.toFixed(2)}%`,
    col1X,
    yPos
  );
  doc.text(
    `Average PIPs: +${client.stats.avgPips.toFixed(0)}`,
    col2X,
    yPos
  );
}
