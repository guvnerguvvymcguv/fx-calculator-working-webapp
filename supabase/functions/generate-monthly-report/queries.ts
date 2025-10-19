// Data Aggregation Logic
// Fetches and processes calculation data for monthly reports

interface ClientCalculation {
  id: string;
  created_at: string;
  client_name: string;
  currency_pair: string;
  your_rate: number;
  competitor_rate: number;
  amount_to_buy: number;
  trades_per_year: number;
  price_difference: number;
  payment_amount: number; // PIPs
  cost_with_competitor: number;
  cost_with_us: number;
  savings_per_trade: number;
  annual_savings: number;
  percentage_savings: number;
  user_id: string;
  user_name?: string;
}

interface ClientData {
  clientName: string;
  calculations: ClientCalculation[];
  broker: string;
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
}

interface ReportSummary {
  totalClients: number;
  totalCalculations: number;
  combinedMonthlySavings: number;
  combinedAnnualSavings: number;
  currencyPairDistribution: { [pair: string]: number };
}

export async function aggregateClientData(
  supabase: any,
  companyId: string,
  startDate: string,
  endDate: string
): Promise<{ summary: ReportSummary; clients: ClientData[] }> {
  
  // Fetch all calculations for this company in the date range
  const { data: calculations, error } = await supabase
    .from('activity_logs')
    .select(`
      *,
      user_profiles!inner (
        id,
        full_name,
        company_id
      )
    `)
    .eq('user_profiles.company_id', companyId)
    .eq('action_type', 'calculation')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('client_name')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch calculations: ${error.message}`);
  }

  if (!calculations || calculations.length === 0) {
    return {
      summary: {
        totalClients: 0,
        totalCalculations: 0,
        combinedMonthlySavings: 0,
        combinedAnnualSavings: 0,
        currencyPairDistribution: {},
      },
      clients: [],
    };
  }

  // Group by client name (normalized)
  const clientGroups: { [key: string]: ClientCalculation[] } = {};
  
  calculations.forEach((calc: any) => {
    const normalizedName = calc.client_name.toLowerCase().trim();
    if (!clientGroups[normalizedName]) {
      clientGroups[normalizedName] = [];
    }
    clientGroups[normalizedName].push({
      ...calc,
      user_name: calc.user_profiles?.full_name || 'Unknown',
    });
  });

  // Process each client
  const clients: ClientData[] = [];
  const globalPairDistribution: { [pair: string]: number } = {};
  let totalAnnualSavings = 0;

  for (const [normalizedName, calcs] of Object.entries(clientGroups)) {
    const clientName = calcs[0].client_name; // Use original case
    const broker = calcs[0].user_name || 'Unknown';

    // Calculate stats
    const pairCounts: { [pair: string]: number } = {};
    let totalTradeValue = 0;
    let totalSavingsPerTrade = 0;
    let totalAnnualSavingsForClient = 0;
    let totalPercentageSavings = 0;
    let totalPips = 0;
    let tradesPerYear = 0;

    calcs.forEach(calc => {
      // Currency pairs
      const pair = calc.currency_pair;
      pairCounts[pair] = (pairCounts[pair] || 0) + 1;
      globalPairDistribution[pair] = (globalPairDistribution[pair] || 0) + 1;

      // Aggregations
      totalTradeValue += calc.amount_to_buy || calc.amount || 0;
      totalSavingsPerTrade += calc.savings_per_trade || 0;
      totalAnnualSavingsForClient += calc.annual_savings || 0;
      totalPercentageSavings += calc.percentage_savings || 0;
      totalPips += calc.payment_amount || calc.pips_difference || 0;
      
      // Use trades_per_year from most recent calculation
      if (calc.trades_per_year) {
        tradesPerYear = calc.trades_per_year;
      }
    });

    const numCalcs = calcs.length;
    const avgTradeValue = totalTradeValue / numCalcs;
    const avgSavingsPerTrade = totalSavingsPerTrade / numCalcs;
    const avgPercentageSavings = totalPercentageSavings / numCalcs;
    const avgPips = totalPips / numCalcs;
    const tradesPerMonth = tradesPerYear > 0 ? tradesPerYear / 12 : 0;
    const monthlyTradeVolume = avgTradeValue * tradesPerMonth;

    totalAnnualSavings += totalAnnualSavingsForClient;

    clients.push({
      clientName,
      calculations: calcs,
      broker,
      stats: {
        totalCalculations: numCalcs,
        currencyPairs: pairCounts,
        tradesPerYear,
        tradesPerMonth: Math.round(tradesPerMonth * 10) / 10,
        avgTradeValue,
        monthlyTradeVolume,
        avgSavingsPerTrade,
        combinedAnnualSavings: totalAnnualSavingsForClient,
        avgPercentageSavings,
        avgPips,
      },
    });
  }

  // Sort clients by number of calculations (most active first)
  clients.sort((a, b) => b.stats.totalCalculations - a.stats.totalCalculations);

  // Calculate monthly savings (annual / 12)
  const combinedMonthlySavings = totalAnnualSavings / 12;

  const summary: ReportSummary = {
    totalClients: clients.length,
    totalCalculations: calculations.length,
    combinedMonthlySavings,
    combinedAnnualSavings: totalAnnualSavings,
    currencyPairDistribution: globalPairDistribution,
  };

  return { summary, clients };
}
