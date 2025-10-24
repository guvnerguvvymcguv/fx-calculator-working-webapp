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
  const containerStartY = 15;
  const containerPadding = 10;
  const contentX = 20;
  const labelX = 25;
  const valueX = 90;

  const numPairs = Object.keys(client.stats.currencyPairs).length;
  
  const contentHeight = 
    10 +
    8 +
    10 +
    8 +
    12 +
    7 +
    (numPairs * 7) +
    10 +
    (8 * 8);
  
  const boxHeight = contentHeight + (containerPadding * 2);

  drawGlassmorphicBox(doc, 10, containerStartY, 190, boxHeight);

  let yPos = containerStartY + containerPadding;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.primary);
  doc.text(client.clientName.toUpperCase(), contentX, yPos);

  yPos += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textSecondary);
  doc.text(`Broker: ${client.broker}`, contentX, yPos);

  yPos += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary);
  doc.text('SUMMARY', contentX, yPos);

  yPos += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Currency Pairs Traded:', labelX, yPos);

  yPos += 7;
  const sortedPairs = Object.entries(client.stats.currencyPairs)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  doc.setFontSize(10);
  sortedPairs.forEach(([pair, count]) => {
    const percentage = ((count as number / client.stats.totalCalculations) * 100).toFixed(1);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(`${pair}:`, labelX, yPos);
    doc.setTextColor(...COLORS.text);
    doc.text(`${count} calculations (${percentage}%)`, 50, yPos);
    yPos += 7;
  });

  yPos += 10;

  doc.setFontSize(11);
  
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Trades Per Year:', labelX, yPos);
  doc.setTextColor(...COLORS.text);
  doc.text(client.stats.tradesPerYear.toString(), valueX, yPos);
  yPos += 8;

  doc.setTextColor(...COLORS.textMuted);
  doc.text('Trades Per Month:', labelX, yPos);
  doc.setTextColor(...COLORS.text);
  doc.text(`~${client.stats.tradesPerMonth}`, valueX, yPos);
  yPos += 8;

  doc.setTextColor(...COLORS.textMuted);
  doc.text('Monthly Trade Volume:', labelX, yPos);
  doc.setTextColor(...COLORS.text);
  doc.text(
    `~£${client.stats.monthlyTradeVolume.toLocaleString('en-GB', {
      maximumFractionDigits: 0,
    })}`,
    valueX,
    yPos
  );
  yPos += 8;

  doc.setTextColor(...COLORS.textMuted);
  doc.text('Average % Savings:', labelX, yPos);
  doc.setTextColor(...COLORS.text);
  doc.text(`${client.stats.avgPercentageSavings.toFixed(2)}%`, valueX, yPos);
  yPos += 8;

  doc.setTextColor(...COLORS.textMuted);
  doc.text('Combined Annual Savings:', labelX, yPos);
  doc.setTextColor(...COLORS.accent);
  doc.text(
    `£${client.stats.combinedAnnualSavings.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    valueX,
    yPos
  );
  yPos += 8;

  doc.setTextColor(...COLORS.textMuted);
  doc.text('Average Trade Value:', labelX, yPos);
  doc.setTextColor(...COLORS.text);
  doc.text(
    `£${client.stats.avgTradeValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
    valueX,
    yPos
  );
  yPos += 8;

  doc.setTextColor(...COLORS.textMuted);
  doc.text('Average Savings Per Trade:', labelX, yPos);
  doc.setTextColor(...COLORS.text);
  doc.text(
    `£${client.stats.avgSavingsPerTrade.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    valueX,
    yPos
  );
  yPos += 8;

  doc.setTextColor(...COLORS.textMuted);
  doc.text('Average PIPs:', labelX, yPos);
  doc.setTextColor(...COLORS.text);
  doc.text(`+${client.stats.avgPips.toFixed(0)}`, valueX, yPos);
}