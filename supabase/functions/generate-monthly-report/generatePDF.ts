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

function addDarkBackground(doc: jsPDF) {
  doc.setFillColor(...COLORS.background);
  doc.rect(0, 0, 210, 297, 'F');
}

function drawGlassmorphicBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number = 0.7
) {
  const currentFillColor = doc.getFillColor();
  const currentDrawColor = doc.getDrawColor();

  doc.setFillColor(...COLORS.glassBg);
  doc.roundedRect(x, y, width, height, 3, 3, 'F');

  doc.setDrawColor(...COLORS.glassBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 3, 3, 'S');

  doc.setFillColor(currentFillColor);
  doc.setDrawColor(currentDrawColor);
  doc.setLineWidth(0.2);
}

export async function generatePDF(data: PDFData): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  addDarkBackground(doc);
  addCoverPage(doc, data);

  data.clients.forEach((client, index) => {
    doc.addPage();
    addDarkBackground(doc);
    addClientPage(doc, client, data.monthName, index);
  });

  const pdfBlob = doc.output('arraybuffer');
  return new Uint8Array(pdfBlob);
}

function addCoverPage(doc: jsPDF, data: PDFData) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(...COLORS.text);
  doc.text('SPREAD CHECKER', 20, 30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.text);
  doc.text('Client Data Report', 20, 45);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textSecondary);
  doc.text(`Period: ${data.monthName}`, 20, 55);
  doc.text(`Company: ${data.companyName}`, 20, 62);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 20, 69);

  const summaryBoxY = 80;
  const summaryBoxHeight = 60;
  drawGlassmorphicBox(doc, 15, summaryBoxY, 180, summaryBoxHeight);

  const boxY = summaryBoxY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary);
  doc.text('MONTHLY SUMMARY', 20, boxY);

  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Clients with Activity:', 25, boxY + 12);
  doc.setTextColor(...COLORS.text);
  doc.text(data.summary.totalClients.toString(), 90, boxY + 12);

  doc.setTextColor(...COLORS.textMuted);
  doc.text('Total Calculations:', 25, boxY + 20);
  doc.setTextColor(...COLORS.text);
  doc.text(data.summary.totalCalculations.toString(), 90, boxY + 20);

  doc.setTextColor(...COLORS.textMuted);
  doc.text('Combined Monthly Savings:', 25, boxY + 28);
  doc.setTextColor(...COLORS.accent);
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

  const pairBoxY = summaryBoxY + summaryBoxHeight + 10;
  const sortedPairs = Object.entries(data.summary.currencyPairDistribution)
    .sort(([, a], [, b]) => b - a);

  const pairBoxHeight = Math.max(40, sortedPairs.length * 7 + 25);
  drawGlassmorphicBox(doc, 15, pairBoxY, 180, pairBoxHeight);

  const pairY = pairBoxY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary);
  doc.text('CURRENCY PAIR DISTRIBUTION', 20, pairY);

  let pairTextY = pairY + 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  sortedPairs.forEach(([pair, count]) => {
    const percentage = ((count / data.summary.totalCalculations) * 100).toFixed(1);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(`${pair}:`, 25, pairTextY);
    doc.setTextColor(...COLORS.text);
    doc.text(`${count} calculations (${percentage}%)`, 50, pairTextY);
    pairTextY += 7;
  });
}

function addClientPage(doc: jsPDF, client: any, monthName: string, pageIndex: number) {
  // Use EXACT same pattern as cover page boxes
  const containerStartY = 15;
  const containerPadding = 10; // Same as cover page (boxY = summaryBoxY + 10)
  const contentX = 20; // Same as cover page
  const labelX = 25; // Same as cover page
  const valueX = 90; // Same as cover page

  // Calculate where the last line of text will be
  const numPairs = Object.keys(client.stats.currencyPairs).length;

  // Starting from boxY (which is containerStartY + containerPadding):
  // Company name at: boxY + 0
  // Broker at: boxY + 10
  // SUMMARY at: boxY + 18
  // Currency Pairs Traded at: boxY + 30
  // Currency pairs list at: boxY + 37 to boxY + 37 + (numPairs-1) * 7
  // Last currency pair at: boxY + 37 + (numPairs-1) * 7 = boxY + 30 + (numPairs * 7)
  // Stats start at: boxY + 30 + (numPairs * 7) + 10 = boxY + 40 + (numPairs * 7)
  // Last stat (Average PIPs) at: statsStartY + 56

  const lastLineY = 40 + (numPairs * 7) + 56; // Offset from boxY
  const contentHeight = lastLineY;
  const boxHeight = contentHeight + (containerPadding * 2); // Equal padding top and bottom

  drawGlassmorphicBox(doc, 10, containerStartY, 190, boxHeight);

  // Use absolute positioning pattern like cover page
  const boxY = containerStartY + containerPadding;

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.primary);
  doc.text(client.clientName.toUpperCase(), contentX, boxY);

  // Broker
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textSecondary);
  doc.text(`Broker: ${client.broker}`, contentX, boxY + 10);

  // SUMMARY header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary);
  doc.text('SUMMARY', contentX, boxY + 18);

  // Currency Pairs Traded (starts at boxY + 30)
  let currencyPairsY = boxY + 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Currency Pairs Traded:', labelX, currencyPairsY);

  currencyPairsY += 7;
  const sortedPairs = Object.entries(client.stats.currencyPairs)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  doc.setFontSize(10);
  sortedPairs.forEach(([pair, count]) => {
    const percentage = ((count as number / client.stats.totalCalculations) * 100).toFixed(1);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(`${pair}:`, labelX, currencyPairsY);
    doc.setTextColor(...COLORS.text);
    doc.text(`${count} calculations (${percentage}%)`, 50, currencyPairsY);
    currencyPairsY += 7;
  });

  // Stats section - use absolute positioning like cover page (boxY + offset)
  const statsStartY = currencyPairsY + 10; // 10mm space after currency pairs

  doc.setFontSize(11);

  // Trades Per Year
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Trades Per Year:', labelX, statsStartY);
  doc.setTextColor(...COLORS.text);
  doc.text(client.stats.tradesPerYear.toString(), valueX, statsStartY);

  // Trades Per Month (statsStartY + 8)
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Trades Per Month:', labelX, statsStartY + 8);
  doc.setTextColor(...COLORS.text);
  doc.text(`~${client.stats.tradesPerMonth}`, valueX, statsStartY + 8);

  // Monthly Trade Volume (statsStartY + 16)
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Monthly Trade Volume:', labelX, statsStartY + 16);
  doc.setTextColor(...COLORS.text);
  doc.text(
    `~£${client.stats.monthlyTradeVolume.toLocaleString('en-GB', {
      maximumFractionDigits: 0,
    })}`,
    valueX,
    statsStartY + 16
  );

  // Average % Savings (statsStartY + 24)
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Average % Savings:', labelX, statsStartY + 24);
  doc.setTextColor(...COLORS.text);
  doc.text(`${client.stats.avgPercentageSavings.toFixed(2)}%`, valueX, statsStartY + 24);

  // Combined Annual Savings (statsStartY + 32) - use accent color like cover page
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Combined Annual Savings:', labelX, statsStartY + 32);
  doc.setTextColor(...COLORS.accent);
  doc.text(
    `£${client.stats.combinedAnnualSavings.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    valueX,
    statsStartY + 32
  );

  // Average Trade Value (statsStartY + 40)
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Average Trade Value:', labelX, statsStartY + 40);
  doc.setTextColor(...COLORS.text);
  doc.text(
    `£${client.stats.avgTradeValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
    valueX,
    statsStartY + 40
  );

  // Average Savings Per Trade (statsStartY + 48)
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Average Savings Per Trade:', labelX, statsStartY + 48);
  doc.setTextColor(...COLORS.text);
  doc.text(
    `£${client.stats.avgSavingsPerTrade.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    valueX,
    statsStartY + 48
  );

  // Average PIPs (statsStartY + 56)
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Average PIPs:', labelX, statsStartY + 56);
  doc.setTextColor(...COLORS.text);
  doc.text(`+${client.stats.avgPips.toFixed(0)}`, valueX, statsStartY + 56);
}