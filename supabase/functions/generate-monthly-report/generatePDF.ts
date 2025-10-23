// PDF Generation with jsPDF
// Creates professional Bloomberg-style client reports

import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';

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

export async function generatePDF(data: PDFData): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Page 1: Cover & Summary
  addCoverPage(doc, data);

  // Pages 2+: Per-client breakdowns
  data.clients.forEach((client, index) => {
    doc.addPage();
    addClientPage(doc, client, data.monthName, index);
  });

  // Convert to Uint8Array
  const pdfBlob = doc.output('arraybuffer');
  return new Uint8Array(pdfBlob);
}

function addCoverPage(doc: jsPDF, data: PDFData) {
  // Header
  doc.setFontSize(32);
  doc.setTextColor(147, 51, 234); // Purple
  doc.text('SPREAD CHECKER', 20, 30);

  doc.setFontSize(24);
  doc.setTextColor(0, 0, 0);
  doc.text('Client Data Report', 20, 45);

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Period: ${data.monthName}`, 20, 55);
  doc.text(`Company: ${data.companyName}`, 20, 62);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 20, 69);

  // Summary box
  const boxY = 85;
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('MONTHLY SUMMARY', 20, boxY);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text('Clients with Activity:', 25, boxY + 12);
  doc.setTextColor(0, 0, 0);
  doc.text(data.summary.totalClients.toString(), 90, boxY + 12);

  doc.setTextColor(100, 100, 100);
  doc.text('Total Calculations:', 25, boxY + 20);
  doc.setTextColor(0, 0, 0);
  doc.text(data.summary.totalCalculations.toString(), 90, boxY + 20);

  doc.setTextColor(100, 100, 100);
  doc.text('Combined Monthly Savings:', 25, boxY + 28);
  doc.setTextColor(16, 185, 129); // Green
  doc.text(
    `£${data.summary.combinedMonthlySavings.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    90,
    boxY + 28
  );

  doc.setTextColor(100, 100, 100);
  doc.text('Combined Annual Savings:', 25, boxY + 36);
  doc.setTextColor(16, 185, 129);
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
  doc.setTextColor(0, 0, 0);
  doc.text('CURRENCY PAIR DISTRIBUTION', 20, pairY);

  let pairTextY = pairY + 10;
  const sortedPairs = Object.entries(data.summary.currencyPairDistribution)
    .sort(([, a], [, b]) => b - a);

  doc.setFontSize(10);
  sortedPairs.forEach(([pair, count]) => {
    const percentage = ((count / data.summary.totalCalculations) * 100).toFixed(1);
    doc.setTextColor(100, 100, 100);
    doc.text(`${pair}:`, 25, pairTextY);
    doc.setTextColor(0, 0, 0);
    doc.text(`${count} calculations (${percentage}%)`, 50, pairTextY);
    pairTextY += 7;
  });
}

function addClientPage(doc: jsPDF, client: any, monthName: string, pageIndex: number) {
  // Client header
  doc.setFontSize(18);
  doc.setTextColor(147, 51, 234);
  doc.text(client.clientName.toUpperCase(), 20, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Calculations This Month: ${client.stats.totalCalculations}`, 20, 28);
  doc.text(`Broker: ${client.broker}`, 20, 34);

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 40, 190, 40);

  // Trading Profile
  let yPos = 48;
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('TRADING PROFILE', 20, yPos);

  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Currency Pairs Traded:', 25, yPos);

  yPos += 6;
  const sortedPairs = Object.entries(client.stats.currencyPairs)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  doc.setFontSize(9);
  sortedPairs.forEach(([pair, count]) => {
    const percentage = ((count as number / client.stats.totalCalculations) * 100).toFixed(1);
    doc.setTextColor(100, 100, 100);
    doc.text(`${pair}:`, 30, yPos);
    doc.setTextColor(0, 0, 0);
    doc.text(`${count} calculations (${percentage}%)`, 55, yPos);
    yPos += 5;
  });

  yPos += 3;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Volume:', 25, yPos);

  yPos += 6;
  doc.setFontSize(9);
  doc.text('Trades Per Year:', 30, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(client.stats.tradesPerYear.toString(), 80, yPos);

  yPos += 5;
  doc.setTextColor(100, 100, 100);
  doc.text('Trades Per Month:', 30, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(`~${client.stats.tradesPerMonth}`, 80, yPos);

  yPos += 5;
  doc.setTextColor(100, 100, 100);
  doc.text('Avg Trade Value:', 30, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(
    `£${client.stats.avgTradeValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
    80,
    yPos
  );

  yPos += 5;
  doc.setTextColor(100, 100, 100);
  doc.text('Monthly Trade Volume:', 30, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(
    `~£${client.stats.monthlyTradeVolume.toLocaleString('en-GB', {
      maximumFractionDigits: 0,
    })}`,
    80,
    yPos
  );

  // Divider
  yPos += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPos, 190, yPos);

  // Monthly Summary
  yPos += 8;
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('MONTHLY SUMMARY', 20, yPos);

  yPos += 8;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Average Savings/Trade:', 25, yPos);
  doc.setTextColor(16, 185, 129);
  doc.text(
    `£${client.stats.avgSavingsPerTrade.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    80,
    yPos
  );

  yPos += 5;
  doc.setTextColor(100, 100, 100);
  doc.text('Combined Annual Savings:', 25, yPos);
  doc.setTextColor(16, 185, 129);
  doc.text(
    `£${client.stats.combinedAnnualSavings.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    80,
    yPos
  );

  yPos += 5;
  doc.setTextColor(100, 100, 100);
  doc.text('Average % Savings:', 25, yPos);
  doc.setTextColor(16, 185, 129);
  doc.text(`${client.stats.avgPercentageSavings.toFixed(2)}%`, 80, yPos);

  yPos += 5;
  doc.setTextColor(100, 100, 100);
  doc.text('Average PIPs Added:', 25, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(`+${client.stats.avgPips.toFixed(0)}`, 80, yPos);

  // Calculations List
  yPos += 12;
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`${monthName.toUpperCase()} CALCULATIONS`, 20, yPos);

  yPos += 8;

  // Show each calculation (limit to first 3 to avoid overflow)
  const maxCalcs = Math.min(client.calculations.length, 3);
  client.calculations.slice(0, maxCalcs).forEach((calc: any, index: number) => {
    if (yPos > 250) {
      doc.addPage();
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
    doc.setTextColor(147, 51, 234);
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
      doc.setTextColor(100, 100, 100);
      doc.text(label, 30, yPos);
      doc.setTextColor(0, 0, 0);
      doc.text(value, 65, yPos);
      yPos += 4;
    });

    yPos += 3;
  });

  if (client.calculations.length > maxCalcs) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `... and ${client.calculations.length - maxCalcs} more calculations`,
      25,
      yPos
    );
  }
}
