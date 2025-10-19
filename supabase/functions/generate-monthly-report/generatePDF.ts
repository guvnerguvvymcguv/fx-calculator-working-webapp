// PDF Generation with PDFKit
// Creates professional Bloomberg-style client reports

import PDFDocument from 'https://esm.sh/pdfkit@0.13.0';

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

// Color scheme
const COLORS = {
  primary: '#9333ea',      // Purple
  secondary: '#7e22ce',    // Dark purple
  background: '#1a1a2e',   // Dark navy
  text: '#ffffff',         // White
  textMuted: '#a0a0a0',    // Light grey
  accent: '#10b981',       // Green (for savings)
  border: '#333344',       // Subtle border
};

export async function generatePDF(data: PDFData): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true,
      });

      const chunks: Uint8Array[] = [];
      
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const result = new Uint8Array(
          chunks.reduce((acc, chunk) => acc + chunk.length, 0)
        );
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(result);
      });
      doc.on('error', reject);

      // Page 1: Cover & Summary
      addCoverPage(doc, data);

      // Pages 2+: Per-client breakdowns
      data.clients.forEach((client, index) => {
        if (index > 0) {
          doc.addPage();
        } else {
          doc.addPage();
        }
        addClientPage(doc, client, data.monthName);
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function addCoverPage(doc: any, data: PDFData) {
  // Header
  doc
    .fontSize(32)
    .fillColor(COLORS.primary)
    .text('SPREAD CHECKER', 50, 50);

  doc
    .fontSize(24)
    .fillColor(COLORS.text)
    .text('Client Data Report', 50, 90);

  doc
    .fontSize(12)
    .fillColor(COLORS.textMuted)
    .text(`Period: ${data.monthName}`, 50, 125)
    .text(`Company: ${data.companyName}`, 50, 142)
    .text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 50, 159);

  // Summary box
  const boxY = 220;
  doc
    .fontSize(16)
    .fillColor(COLORS.text)
    .text('MONTHLY SUMMARY', 50, boxY);

  doc
    .fontSize(11)
    .fillColor(COLORS.textMuted)
    .text('Clients with Activity:', 70, boxY + 35)
    .fillColor(COLORS.text)
    .text(data.summary.totalClients.toString(), 250, boxY + 35);

  doc
    .fillColor(COLORS.textMuted)
    .text('Total Calculations:', 70, boxY + 55)
    .fillColor(COLORS.text)
    .text(data.summary.totalCalculations.toString(), 250, boxY + 55);

  doc
    .fillColor(COLORS.textMuted)
    .text('Combined Monthly Savings:', 70, boxY + 75)
    .fillColor(COLORS.accent)
    .text(
      `£${data.summary.combinedMonthlySavings.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      250,
      boxY + 75
    );

  doc
    .fillColor(COLORS.textMuted)
    .text('Combined Annual Savings:', 70, boxY + 95)
    .fillColor(COLORS.accent)
    .text(
      `£${data.summary.combinedAnnualSavings.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      250,
      boxY + 95
    );

  // Currency pair breakdown
  const pairY = boxY + 140;
  doc
    .fontSize(14)
    .fillColor(COLORS.text)
    .text('CURRENCY PAIR DISTRIBUTION', 50, pairY);

  let pairTextY = pairY + 30;
  const sortedPairs = Object.entries(data.summary.currencyPairDistribution)
    .sort(([, a], [, b]) => b - a);

  sortedPairs.forEach(([pair, count]) => {
    const percentage = ((count / data.summary.totalCalculations) * 100).toFixed(1);
    doc
      .fontSize(10)
      .fillColor(COLORS.textMuted)
      .text(`${pair}:`, 70, pairTextY)
      .fillColor(COLORS.text)
      .text(`${count} calculations (${percentage}%)`, 150, pairTextY);
    pairTextY += 20;
  });
}

function addClientPage(doc: any, client: any, monthName: string) {
  // Client header
  doc
    .fontSize(18)
    .fillColor(COLORS.primary)
    .text(client.clientName.toUpperCase(), 50, 50);

  doc
    .fontSize(10)
    .fillColor(COLORS.textMuted)
    .text(`Calculations This Month: ${client.stats.totalCalculations}`, 50, 75)
    .text(`Broker: ${client.broker}`, 50, 90);

  // Divider
  doc
    .moveTo(50, 110)
    .lineTo(545, 110)
    .strokeColor(COLORS.border)
    .stroke();

  // Trading Profile
  let yPos = 130;
  doc
    .fontSize(14)
    .fillColor(COLORS.text)
    .text('TRADING PROFILE', 50, yPos);

  yPos += 25;
  doc
    .fontSize(10)
    .fillColor(COLORS.textMuted)
    .text('Currency Pairs Traded:', 70, yPos);

  yPos += 18;
  const sortedPairs = Object.entries(client.stats.currencyPairs)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  sortedPairs.forEach(([pair, count]) => {
    const percentage = ((count as number / client.stats.totalCalculations) * 100).toFixed(1);
    doc
      .fontSize(9)
      .fillColor(COLORS.textMuted)
      .text(`├─ ${pair}:`, 90, yPos)
      .fillColor(COLORS.text)
      .text(`${count} calculations (${percentage}%)`, 180, yPos);
    yPos += 16;
  });

  yPos += 10;
  doc
    .fontSize(10)
    .fillColor(COLORS.textMuted)
    .text('Volume:', 70, yPos);

  yPos += 18;
  doc
    .fontSize(9)
    .fillColor(COLORS.textMuted)
    .text(`├─ Trades Per Year:`, 90, yPos)
    .fillColor(COLORS.text)
    .text(client.stats.tradesPerYear.toString(), 250, yPos);

  yPos += 16;
  doc
    .fillColor(COLORS.textMuted)
    .text(`├─ Trades Per Month:`, 90, yPos)
    .fillColor(COLORS.text)
    .text(`~${client.stats.tradesPerMonth}`, 250, yPos);

  yPos += 16;
  doc
    .fillColor(COLORS.textMuted)
    .text(`├─ Avg Trade Value:`, 90, yPos)
    .fillColor(COLORS.text)
    .text(
      `£${client.stats.avgTradeValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
      250,
      yPos
    );

  yPos += 16;
  doc
    .fillColor(COLORS.textMuted)
    .text(`└─ Monthly Trade Volume:`, 90, yPos)
    .fillColor(COLORS.text)
    .text(
      `~£${client.stats.monthlyTradeVolume.toLocaleString('en-GB', {
        maximumFractionDigits: 0,
      })}`,
      250,
      yPos
    );

  // Divider
  yPos += 25;
  doc
    .moveTo(50, yPos)
    .lineTo(545, yPos)
    .strokeColor(COLORS.border)
    .stroke();

  // Monthly Summary
  yPos += 20;
  doc
    .fontSize(14)
    .fillColor(COLORS.text)
    .text('MONTHLY SUMMARY', 50, yPos);

  yPos += 25;
  doc
    .fontSize(9)
    .fillColor(COLORS.textMuted)
    .text('Average Savings/Trade:', 70, yPos)
    .fillColor(COLORS.accent)
    .text(
      `£${client.stats.avgSavingsPerTrade.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      250,
      yPos
    );

  yPos += 16;
  doc
    .fillColor(COLORS.textMuted)
    .text('Combined Annual Savings:', 70, yPos)
    .fillColor(COLORS.accent)
    .text(
      `£${client.stats.combinedAnnualSavings.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      250,
      yPos
    );

  yPos += 16;
  doc
    .fillColor(COLORS.textMuted)
    .text('Average % Savings:', 70, yPos)
    .fillColor(COLORS.accent)
    .text(`${client.stats.avgPercentageSavings.toFixed(2)}%`, 250, yPos);

  yPos += 16;
  doc
    .fillColor(COLORS.textMuted)
    .text('Average PIPs Added:', 70, yPos)
    .fillColor(COLORS.text)
    .text(`+${client.stats.avgPips.toFixed(0)}`, 250, yPos);

  // Calculations List
  yPos += 35;
  doc
    .fontSize(14)
    .fillColor(COLORS.text)
    .text(`${monthName.toUpperCase()} CALCULATIONS`, 50, yPos);

  yPos += 25;

  // Show each calculation
  client.calculations.forEach((calc: any, index: number) => {
    if (yPos > 700) {
      doc.addPage();
      yPos = 50;
    }

    const calcDate = new Date(calc.created_at);
    const dateStr = calcDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    doc
      .fontSize(10)
      .fillColor(COLORS.primary)
      .text(`Calc ${index + 1} - ${dateStr}`, 70, yPos);

    yPos += 18;
    const calcDetails = [
      ['Pair:', calc.currency_pair],
      ['Their Rate:', calc.competitor_rate?.toFixed(4)],
      ['Our Rate:', calc.your_rate?.toFixed(4)],
      ['Amount to Buy:', `£${calc.amount_to_buy?.toLocaleString()}`],
      ['Trades/Year:', calc.trades_per_year],
      ['Price Difference:', `${calc.price_difference >= 0 ? '+' : ''}${calc.price_difference?.toFixed(4)}`],
      ['PIPs:', calc.payment_amount || calc.pips_difference],
      [
        'Cost w/ Competitor:',
        `£${calc.cost_with_competitor?.toLocaleString('en-GB', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      ],
      [
        'Cost w/ Us:',
        `£${calc.cost_with_us?.toLocaleString('en-GB', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      ],
      [
        'Savings/Trade:',
        `£${calc.savings_per_trade?.toLocaleString('en-GB', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      ],
      [
        'Annual Savings:',
        `£${calc.annual_savings?.toLocaleString('en-GB', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      ],
      ['% Savings:', `${calc.percentage_savings?.toFixed(2)}%`],
    ];

    calcDetails.forEach(([label, value]) => {
      doc
        .fontSize(8)
        .fillColor(COLORS.textMuted)
        .text(`├─ ${label}`, 90, yPos)
        .fillColor(COLORS.text)
        .text(value, 220, yPos);
      yPos += 13;
    });

    yPos += 10;
  });
}
