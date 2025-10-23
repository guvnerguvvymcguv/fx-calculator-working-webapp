// PDF Generation with jsPDF
// Creates professional SpreadChecker-branded client reports

import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';

// SpreadChecker Brand Colors
const COLORS = {
  background: [16, 5, 26] as [number, number, number],        // #10051A - Dark purple/black background
  primary: [102, 126, 234] as [number, number, number],       // #667eea - Purple for titles
  text: [255, 255, 255] as [number, number, number],          // #ffffff - White text
  textSecondary: [224, 224, 224] as [number, number, number], // #e0e0e0 - Slightly dimmed white
  textMuted: [156, 163, 175] as [number, number, number],     // #9ca3af - Muted gray
  accent: [16, 185, 129] as [number, number, number],         // #10b981 - Green for savings
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
  doc.setFontSize(32);
  doc.setTextColor(...COLORS.primary); // Purple brand color
  doc.text('SPREAD CHECKER', 20, 30);

  doc.setFontSize(24);
  doc.setTextColor(...COLORS.text); // White text
  doc.text('Client Data Report', 20, 45);

  doc.setFontSize(12);
  doc.setTextColor(...COLORS.textSecondary); // Light gray for metadata
  doc.text(`Period: ${data.monthName}`, 20, 55);
  doc.text(`Company: ${data.companyName}`, 20, 62);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 20, 69);

  // Summary box
  const boxY = 85;
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary); // Purple for section headers
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

  // Currency pair breakdown
  const pairY = boxY + 50;
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary); // Purple for section headers
  doc.text('CURRENCY PAIR DISTRIBUTION', 20, pairY);

  let pairTextY = pairY + 10;
  const sortedPairs = Object.entries(data.summary.currencyPairDistribution)
    .sort(([, a], [, b]) => b - a);

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

function addClientPage(doc: jsPDF, client: any, monthName: string, pageIndex: number) {
  // Client header
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.primary); // Purple for client name
  doc.text(client.clientName.toUpperCase(), 20, 20);

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textSecondary); // Light gray for metadata
  doc.text(`Calculations This Month: ${client.stats.totalCalculations}`, 20, 28);
  doc.text(`Broker: ${client.broker}`, 20, 34);

  // Divider line
  doc.setDrawColor(...COLORS.divider); // Dark gray divider
  doc.line(20, 40, 190, 40);

  // Trading Profile
  let yPos = 48;
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary); // Purple for section headers
  doc.text('TRADING PROFILE', 20, yPos);

  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textMuted); // Muted gray for labels
  doc.text('Currency Pairs Traded:', 25, yPos);

  yPos += 6;
  const sortedPairs = Object.entries(client.stats.currencyPairs)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  doc.setFontSize(9);
  sortedPairs.forEach(([pair, count]) => {
    const percentage = ((count as number / client.stats.totalCalculations) * 100).toFixed(1);
    doc.setTextColor(...COLORS.textMuted); // Muted gray for labels
    doc.text(`${pair}:`, 30, yPos);
    doc.setTextColor(...COLORS.text); // White for values
    doc.text(`${count} calculations (${percentage}%)`, 55, yPos);
    yPos += 5;
  });

  yPos += 3;
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Volume:', 25, yPos);

  yPos += 6;
  doc.setFontSize(9);
  doc.text('Trades Per Year:', 30, yPos);
  doc.setTextColor(...COLORS.text);
  doc.text(client.stats.tradesPerYear.toString(), 80, yPos);

  yPos += 5;
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Trades Per Month:', 30, yPos);
  doc.setTextColor(...COLORS.text);
  doc.text(`~${client.stats.tradesPerMonth}`, 80, yPos);

  yPos += 5;
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Avg Trade Value:', 30, yPos);
  doc.setTextColor(...COLORS.text);
  doc.text(
    `£${client.stats.avgTradeValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
    80,
    yPos
  );

  yPos += 5;
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Monthly Trade Volume:', 30, yPos);
  doc.setTextColor(...COLORS.text);
  doc.text(
    `~£${client.stats.monthlyTradeVolume.toLocaleString('en-GB', {
      maximumFractionDigits: 0,
    })}`,
    80,
    yPos
  );

  // Divider
  yPos += 8;
  doc.setDrawColor(...COLORS.divider); // Dark gray divider
  doc.line(20, yPos, 190, yPos);

  // Monthly Summary
  yPos += 8;
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary); // Purple for section headers
  doc.text('MONTHLY SUMMARY', 20, yPos);

  yPos += 8;
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textMuted); // Muted gray for labels
  doc.text('Average Savings/Trade:', 25, yPos);
  doc.setTextColor(...COLORS.accent); // Green for savings
  doc.text(
    `£${client.stats.avgSavingsPerTrade.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    80,
    yPos
  );

  yPos += 5;
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Combined Annual Savings:', 25, yPos);
  doc.setTextColor(...COLORS.accent);
  doc.text(
    `£${client.stats.combinedAnnualSavings.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    80,
    yPos
  );

  yPos += 5;
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Average % Savings:', 25, yPos);
  doc.setTextColor(...COLORS.accent);
  doc.text(`${client.stats.avgPercentageSavings.toFixed(2)}%`, 80, yPos);

  yPos += 5;
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Average PIPs Added:', 25, yPos);
  doc.setTextColor(...COLORS.text); // White for regular values
  doc.text(`+${client.stats.avgPips.toFixed(0)}`, 80, yPos);

  // Calculations List
  yPos += 12;
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary); // Purple for section headers
  doc.text(`${monthName.toUpperCase()} CALCULATIONS`, 20, yPos);

  yPos += 8;

  // Show each calculation (limit to first 3 to avoid overflow)
  const maxCalcs = Math.min(client.calculations.length, 3);
  client.calculations.slice(0, maxCalcs).forEach((calc: any, index: number) => {
    if (yPos > 250) {
      doc.addPage();
      addDarkBackground(doc); // Add dark background to new page
      yPos = 20;
    }

    const calcDate = new Date(calc.created_at);
    const dateStr = calcDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    doc.setFontSize(10);
    doc.setTextColor(...COLORS.primary); // Purple for calc header
    doc.text(`Calc ${index + 1} - ${dateStr}`, 25, yPos);

    yPos += 6;
    doc.setFontSize(8);

    const calcDetails = [
      ['Pair:', calc.currency_pair],
      ['Their Rate:', calc.competitor_rate?.toFixed(4)],
      ['Our Rate:', calc.your_rate?.toFixed(4)],
      ['Amount:', `£${calc.amount_to_buy?.toLocaleString()}`],
      ['Savings:', `£${calc.savings_per_trade?.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`],
    ];

    calcDetails.forEach(([label, value]) => {
      doc.setTextColor(...COLORS.textMuted); // Muted gray for labels
      doc.text(label, 30, yPos);
      doc.setTextColor(...COLORS.text); // White for values
      doc.text(value, 65, yPos);
      yPos += 4;
    });

    yPos += 3;
  });

  if (client.calculations.length > maxCalcs) {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textSecondary); // Light gray for overflow message
    doc.text(
      `... and ${client.calculations.length - maxCalcs} more calculations`,
      25,
      yPos
    );
  }
}
