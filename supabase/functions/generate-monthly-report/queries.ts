// Data Aggregation Logic
// Fetches and processes calculation data for monthly reports

import { normalizeCompanyName } from './companyNameUtils.ts';

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
  
  console.log('📊 Fetching calculations for company:', companyId);
  console.log('📅 Date range:', startDate, 'to', endDate);
  
  // First get all junior users for this company
  const { data: juniorUsers, error: juniorError } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .eq('company_id', companyId)
    .eq('role_type', 'junior');

  if (juniorError) {
    console.error('Error fetching junior users:', juniorError);
    throw new Error(`Failed to fetch junior users: ${juniorError.message}`);
  }

  if (!juniorUsers || juniorUsers.length === 0) {
    console.log('No junior users found for company');
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

  const juniorUserIds = juniorUsers.map(u => u.id);
  console.log('Found junior users:', juniorUsers.length, juniorUserIds);

  // Debug: Log the exact date range being queried
  console.log('🔍 Query Parameters:');
  console.log('  - User IDs:', juniorUserIds);
  console.log('  - Start Date:', startDate);
  console.log('  - End Date:', endDate);
  console.log('  - Action Type: calculation');

  // Fetch all calculations for these junior users in the date range
  const { data: calculations, error } = await supabase
    .from('activity_logs')
    .select('*')
    .in('user_id', juniorUserIds)
    .eq('action_type', 'calculation')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('client_name')
    .order('created_at', { ascending: false });

  console.log('Calculations query result:', calculations?.length || 0, 'records found');
  if (error) {
    console.error('Error fetching calculations:', error);
  }

  // Debug: If no calculations found, let's check if ANY exist for these users
  if (!calculations || calculations.length === 0) {
    console.log('⚠️ No calculations found. Checking if calculations exist at all...');
    const { data: anyCalcs, error: anyError } = await supabase
      .from('activity_logs')
      .select('id, created_at, action_type, client_name')
      .in('user_id', juniorUserIds)
      .eq('action_type', 'calculation')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!anyError && anyCalcs) {
      console.log('📋 Sample calculations (most recent 5):', anyCalcs);
      if (anyCalcs.length > 0) {
        console.log('⚠️ Calculations exist but date range mismatch!');
        console.log('   Most recent calculation:', anyCalcs[0].created_at);
        console.log('   Query range:', startDate, 'to', endDate);
      }
    }
  }

  if (error) {
    throw new Error(`Failed to fetch calculations: ${error.message}`);
  }

  if (!calculations || calculations.length === 0) {
    console.log('No calculations found in date range');
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

  // Create a map of user IDs to names
  const userMap: { [key: string]: string } = {};
  juniorUsers.forEach(user => {
    userMap[user.id] = user.full_name || 'Unknown';
  });

  // Group by client name (normalized using proper company name normalization)
  // This removes suffixes like PLC, LIMITED, STORES, etc. to prevent duplicates
  const clientGroups: { [key: string]: ClientCalculation[] } = {};

  calculations.forEach((calc: any) => {
    // Skip if no client name
    if (!calc.client_name || calc.client_name.trim() === '') {
      return;
    }

    // Use proper normalization that removes company suffixes like PLC, LIMITED, STORES, etc.
    // This matches the logic used in the My Leads page
    const normalizedName = normalizeCompanyName(calc.client_name);

    if (!clientGroups[normalizedName]) {
      clientGroups[normalizedName] = [];
    }
    clientGroups[normalizedName].push({
      ...calc,
      user_name: userMap[calc.user_id] || 'Unknown',
    });
  });

  console.log('Grouped into', Object.keys(clientGroups).length, 'unique clients');

  // Process each client
  const clients: ClientData[] = [];
  const globalPairDistribution: { [pair: string]: number } = {};
  let totalAnnualSavings = 0;

  for (const [normalizedName, calcs] of Object.entries(clientGroups)) {
    // Use the shortest client name as it's usually the cleanest
    // e.g., prefer "Tesco" over "TESCO PLC" or "TESCO STORES LIMITED"
    const clientName = calcs
      .map(c => c.client_name)
      .sort((a, b) => a.length - b.length)[0];

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
