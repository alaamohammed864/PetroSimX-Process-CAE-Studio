/**
 * Multi-Chart PetroSimX Market Analytics Types
 * Strictly typed interfaces for real oil & energy market metrics
 */

export type TimeRangeOption = '1M' | '1Y' | '5Y';

export type ChartCardId =
  | 'brent-line'
  | 'opec-bar'
  | 'energy-donut'
  | 'us-stocks-area'
  | 'brent-gas-scatter'
  | 'xom-candlestick'
  | 'orb-gauge';

export interface MonthlyPricePoint {
  date: string;
  year: number;
  month: number;
  price: number;
  high?: number;
  low?: number;
}

export interface OpecProductionPoint {
  country: string;
  countryAr: string;
  countryCode: string;
  productionMbpd: number;
  quotaMbpd: number;
  sharePct: number;
}

export interface PrimaryEnergySource {
  source: string;
  sourceAr: string;
  sharePct: number;
  exajoules: number;
  color: string;
}

export interface CrudeStockPoint {
  date: string;
  stocksMillionBbl: number;
  fiveYearAvg: number;
  daysOfSupply: number;
}

export interface EnergyPriceCorrelationPoint {
  date: string;
  brentPriceUsd: number;
  henryHubPriceUsd: number;
  oilGasRatio: number;
  regime: 'Normal' | 'High Spread' | 'Gas Squeeze';
}

export interface StockCandlePoint {
  date: string;
  open: number;
  close: number;
  lowest: number;
  highest: number;
  volumeMillion: number;
}

export interface OpecBasketMetric {
  currentPrice: number;
  prevPrice: number;
  change: number;
  changePct: number;
  yearLow: number;
  yearHigh: number;
  targetBandMin: number;
  targetBandMax: number;
  date: string;
  components: Array<{
    name: string;
    gravityApi: number;
    sulfurPct: number;
  }>;
}

export interface ChartCardConfig {
  id: ChartCardId;
  title: string;
  titleAr: string;
  category: string;
  unit: string;
  source: string;
  sourceYear: string;
  description: string;
}
