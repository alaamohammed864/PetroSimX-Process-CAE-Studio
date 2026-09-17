import {
  MonthlyPricePoint,
  OpecProductionPoint,
  PrimaryEnergySource,
  CrudeStockPoint,
  EnergyPriceCorrelationPoint,
  StockCandlePoint,
  OpecBasketMetric,
  ChartCardConfig,
} from '../types/dashboard';

/**
 * 1. Monthly Brent Crude Oil Price (Last 5 Years, 2020-2024 / 60 Months)
 * Source: U.S. Energy Information Administration (EIA) - Europe Brent Spot Price FOB ($/bbl)
 */
export const BRENT_CRUDE_MONTHLY_PRICES: MonthlyPricePoint[] = [
  // 2020 (Pandemic Shock & Initial Recovery)
  { date: '2020-01', year: 2020, month: 1, price: 63.65, high: 70.25, low: 58.16 },
  { date: '2020-02', year: 2020, month: 2, price: 55.66, high: 59.40, low: 50.50 },
  { date: '2020-03', year: 2020, month: 3, price: 32.01, high: 52.52, low: 22.58 },
  { date: '2020-04', year: 2020, month: 4, price: 18.38, high: 26.69, low: 9.12 },
  { date: '2020-05', year: 2020, month: 5, price: 29.38, high: 36.17, low: 18.11 },
  { date: '2020-06', year: 2020, month: 6, price: 40.27, high: 43.34, low: 36.95 },
  { date: '2020-07', year: 2020, month: 7, price: 43.24, high: 44.59, low: 41.25 },
  { date: '2020-08', year: 2020, month: 8, price: 44.74, high: 46.46, low: 43.20 },
  { date: '2020-09', year: 2020, month: 9, price: 40.91, high: 42.66, low: 39.52 },
  { date: '2020-10', year: 2020, month: 10, price: 40.19, high: 43.34, low: 36.87 },
  { date: '2020-11', year: 2020, month: 11, price: 43.98, high: 48.96, low: 39.45 },
  { date: '2020-12', year: 2020, month: 12, price: 49.99, high: 52.48, low: 47.14 },

  // 2021 (Global Economic Reopening & Vaccine Rollout)
  { date: '2021-01', year: 2021, month: 1, price: 54.77, high: 57.42, low: 50.83 },
  { date: '2021-02', year: 2021, month: 2, price: 62.28, high: 67.44, low: 57.37 },
  { date: '2021-03', year: 2021, month: 3, price: 65.41, high: 71.38, low: 61.32 },
  { date: '2021-04', year: 2021, month: 4, price: 64.81, high: 68.61, low: 61.74 },
  { date: '2021-05', year: 2021, month: 5, price: 68.53, high: 71.35, low: 65.28 },
  { date: '2021-06', year: 2021, month: 6, price: 73.16, high: 76.18, low: 69.88 },
  { date: '2021-07', year: 2021, month: 7, price: 75.17, high: 77.72, low: 68.40 },
  { date: '2021-08', year: 2021, month: 8, price: 70.75, high: 75.41, low: 64.77 },
  { date: '2021-09', year: 2021, month: 9, price: 74.49, high: 79.28, low: 70.42 },
  { date: '2021-10', year: 2021, month: 10, price: 83.54, high: 86.40, low: 79.28 },
  { date: '2021-11', year: 2021, month: 11, price: 81.05, high: 84.78, low: 70.12 },
  { date: '2021-12', year: 2021, month: 12, price: 74.17, high: 79.32, low: 69.23 },

  // 2022 (Geopolitical Conflict & Supply Inelasticity Peak)
  { date: '2022-01', year: 2022, month: 1, price: 86.51, high: 91.21, low: 78.25 },
  { date: '2022-02', year: 2022, month: 2, price: 97.13, high: 105.79, low: 89.47 },
  { date: '2022-03', year: 2022, month: 3, price: 117.25, high: 139.13, low: 97.44 },
  { date: '2022-04', year: 2022, month: 4, price: 104.58, high: 113.16, low: 98.48 },
  { date: '2022-05', year: 2022, month: 5, price: 113.34, high: 124.40, low: 102.41 },
  { date: '2022-06', year: 2022, month: 6, price: 122.71, high: 125.28, low: 112.55 },
  { date: '2022-07', year: 2022, month: 7, price: 111.93, high: 116.43, low: 98.50 },
  { date: '2022-08', year: 2022, month: 8, price: 100.45, high: 105.15, low: 91.51 },
  { date: '2022-09', year: 2022, month: 9, price: 89.76, high: 96.65, low: 83.65 },
  { date: '2022-10', year: 2022, month: 10, price: 93.33, high: 98.58, low: 88.21 },
  { date: '2022-11', year: 2022, month: 11, price: 91.42, high: 98.75, low: 80.61 },
  { date: '2022-12', year: 2022, month: 12, price: 81.34, high: 87.30, low: 75.11 },

  // 2023 (OPEC+ Voluntary Reductions & Monetary Tightening)
  { date: '2023-01', year: 2023, month: 1, price: 82.50, high: 88.62, low: 77.84 },
  { date: '2023-02', year: 2023, month: 2, price: 82.59, high: 86.90, low: 80.40 },
  { date: '2023-03', year: 2023, month: 3, price: 78.43, high: 86.75, low: 70.12 },
  { date: '2023-04', year: 2023, month: 4, price: 84.64, high: 87.49, low: 77.30 },
  { date: '2023-05', year: 2023, month: 5, price: 75.47, high: 79.52, low: 71.28 },
  { date: '2023-06', year: 2023, month: 6, price: 74.84, high: 77.40, low: 71.57 },
  { date: '2023-07', year: 2023, month: 7, price: 80.11, high: 85.56, low: 74.35 },
  { date: '2023-08', year: 2023, month: 8, price: 86.15, high: 88.10, low: 82.60 },
  { date: '2023-09', year: 2023, month: 9, price: 93.72, high: 97.69, low: 88.00 },
  { date: '2023-10', year: 2023, month: 10, price: 91.05, high: 93.79, low: 86.40 },
  { date: '2023-11', year: 2023, month: 11, price: 82.94, high: 87.55, low: 76.60 },
  { date: '2023-12', year: 2023, month: 12, price: 77.63, high: 80.60, low: 72.29 },

  // 2024 (Balanced Fundamentals & Non-OPEC Growth)
  { date: '2024-01', year: 2024, month: 1, price: 80.12, high: 83.55, low: 75.82 },
  { date: '2024-02', year: 2024, month: 2, price: 83.48, high: 84.80, low: 77.33 },
  { date: '2024-03', year: 2024, month: 3, price: 85.41, high: 87.70, low: 81.25 },
  { date: '2024-04', year: 2024, month: 4, price: 89.00, high: 92.18, low: 86.40 },
  { date: '2024-05', year: 2024, month: 5, price: 81.75, high: 84.70, low: 79.80 },
  { date: '2024-06', year: 2024, month: 6, price: 82.57, high: 86.85, low: 76.76 },
  { date: '2024-07', year: 2024, month: 7, price: 85.31, high: 87.92, low: 79.40 },
  { date: '2024-08', year: 2024, month: 8, price: 80.36, high: 82.30, low: 75.05 },
  { date: '2024-09', year: 2024, month: 9, price: 74.02, high: 75.88, low: 69.19 },
  { date: '2024-10', year: 2024, month: 10, price: 75.38, high: 81.16, low: 71.18 },
  { date: '2024-11', year: 2024, month: 11, price: 73.20, high: 75.50, low: 70.72 },
  { date: '2024-12', year: 2024, month: 12, price: 73.80, high: 74.90, low: 71.85 },
];

/**
 * 2. Daily Crude Oil Production of Top 8 OPEC Member Countries (mb/d)
 * Source: OPEC Annual Statistical Bulletin (ASB) & OPEC Monthly Oil Market Report (MOMR) 2023-2024
 */
export const OPEC_PRODUCTION_DATA: OpecProductionPoint[] = [
  { country: 'Saudi Arabia', countryAr: 'المملكة العربية السعودية', countryCode: 'SA', productionMbpd: 9.05, quotaMbpd: 8.98, sharePct: 34.0 },
  { country: 'Iraq', countryAr: 'العراق', countryCode: 'IQ', productionMbpd: 4.28, quotaMbpd: 4.00, sharePct: 16.1 },
  { country: 'Iran', countryAr: 'إيران', countryCode: 'IR', productionMbpd: 3.25, quotaMbpd: 3.20, sharePct: 12.2 },
  { country: 'UAE', countryAr: 'الإمارات العربية المتحدة', countryCode: 'AE', productionMbpd: 3.12, quotaMbpd: 2.91, sharePct: 11.7 },
  { country: 'Kuwait', countryAr: 'الكويت', countryCode: 'KW', productionMbpd: 2.45, quotaMbpd: 2.41, sharePct: 9.2 },
  { country: 'Nigeria', countryAr: 'نيجيريا', countryCode: 'NG', productionMbpd: 1.44, quotaMbpd: 1.50, sharePct: 5.4 },
  { country: 'Libya', countryAr: 'ليبيا', countryCode: 'LY', productionMbpd: 1.18, quotaMbpd: 1.20, sharePct: 4.4 },
  { country: 'Algeria', countryAr: 'الجزائر', countryCode: 'DZ', productionMbpd: 0.91, quotaMbpd: 0.91, sharePct: 3.4 },
];

/**
 * 3. Global Primary Energy Consumption Shares (%)
 * Source: Energy Institute (EI) Statistical Review of World Energy (formerly BP Statistical Review) 2024
 */
export const PRIMARY_ENERGY_SHARES: PrimaryEnergySource[] = [
  { source: 'Crude Oil', sourceAr: 'النفط الخام', sharePct: 31.2, exajoules: 196.4, color: '#00e5ff' },
  { source: 'Coal', sourceAr: 'الفحم الحجري', sharePct: 26.5, exajoules: 164.2, color: '#64748b' },
  { source: 'Natural Gas', sourceAr: 'الغاز الطبيعي', sharePct: 23.1, exajoules: 144.5, color: '#4edea3' },
  { source: 'Renewables (Solar/Wind/Bio)', sourceAr: 'الطاقة المتجددة (شمس/رياح)', sharePct: 8.2, exajoules: 51.2, color: '#facc15' },
  { source: 'Hydroelectricity', sourceAr: 'الطاقة الكهرومائية', sharePct: 6.7, exajoules: 41.8, color: '#38bdf8' },
  { source: 'Nuclear Energy', sourceAr: 'الطاقة النووية', sharePct: 4.3, exajoules: 26.8, color: '#a855f7' },
];

/**
 * 4. U.S. Commercial Crude Oil Ending Stocks (Excluding SPR) - Weekly (Million Barrels)
 * Source: EIA Weekly Petroleum Status Report (WPSR) 2024
 */
export const US_CRUDE_STOCKS_WEEKLY: CrudeStockPoint[] = [
  { date: '2024-W01', stocksMillionBbl: 432.4, fiveYearAvg: 441.2, daysOfSupply: 26.8 },
  { date: '2024-W03', stocksMillionBbl: 429.9, fiveYearAvg: 439.5, daysOfSupply: 26.5 },
  { date: '2024-W05', stocksMillionBbl: 427.4, fiveYearAvg: 438.1, daysOfSupply: 26.2 },
  { date: '2024-W07', stocksMillionBbl: 442.9, fiveYearAvg: 443.0, daysOfSupply: 27.1 },
  { date: '2024-W09', stocksMillionBbl: 448.5, fiveYearAvg: 446.5, daysOfSupply: 27.6 },
  { date: '2024-W11', stocksMillionBbl: 445.0, fiveYearAvg: 448.2, daysOfSupply: 27.2 },
  { date: '2024-W13', stocksMillionBbl: 451.4, fiveYearAvg: 450.6, daysOfSupply: 27.8 },
  { date: '2024-W15', stocksMillionBbl: 457.1, fiveYearAvg: 453.8, daysOfSupply: 28.1 },
  { date: '2024-W17', stocksMillionBbl: 460.9, fiveYearAvg: 455.0, daysOfSupply: 28.3 },
  { date: '2024-W19', stocksMillionBbl: 459.5, fiveYearAvg: 453.2, daysOfSupply: 28.0 },
  { date: '2024-W21', stocksMillionBbl: 454.7, fiveYearAvg: 451.4, daysOfSupply: 27.6 },
  { date: '2024-W23', stocksMillionBbl: 459.7, fiveYearAvg: 449.1, daysOfSupply: 27.9 },
  { date: '2024-W25', stocksMillionBbl: 460.7, fiveYearAvg: 446.8, daysOfSupply: 28.0 },
  { date: '2024-W27', stocksMillionBbl: 448.5, fiveYearAvg: 443.5, daysOfSupply: 27.1 },
  { date: '2024-W29', stocksMillionBbl: 440.2, fiveYearAvg: 441.2, daysOfSupply: 26.4 },
  { date: '2024-W31', stocksMillionBbl: 436.5, fiveYearAvg: 438.9, daysOfSupply: 26.0 },
  { date: '2024-W33', stocksMillionBbl: 426.0, fiveYearAvg: 436.1, daysOfSupply: 25.3 },
  { date: '2024-W35', stocksMillionBbl: 418.3, fiveYearAvg: 432.8, daysOfSupply: 24.8 },
  { date: '2024-W37', stocksMillionBbl: 417.5, fiveYearAvg: 430.4, daysOfSupply: 24.7 },
  { date: '2024-W39', stocksMillionBbl: 420.6, fiveYearAvg: 429.0, daysOfSupply: 24.9 },
  { date: '2024-W41', stocksMillionBbl: 426.0, fiveYearAvg: 432.1, daysOfSupply: 25.4 },
  { date: '2024-W43', stocksMillionBbl: 425.5, fiveYearAvg: 434.5, daysOfSupply: 25.3 },
  { date: '2024-W45', stocksMillionBbl: 427.6, fiveYearAvg: 438.2, daysOfSupply: 25.6 },
  { date: '2024-W47', stocksMillionBbl: 428.4, fiveYearAvg: 441.0, daysOfSupply: 25.8 },
  { date: '2024-W49', stocksMillionBbl: 425.3, fiveYearAvg: 440.5, daysOfSupply: 25.5 },
  { date: '2024-W51', stocksMillionBbl: 422.1, fiveYearAvg: 438.9, daysOfSupply: 25.2 },
];

/**
 * 5. Scatter Plot: Correlation between Brent Crude ($/bbl) and Natural Gas Henry Hub ($/MMBtu)
 * Source: U.S. Energy Information Administration (EIA) 2021-2024
 */
export const BRENT_HENRY_HUB_CORRELATION: EnergyPriceCorrelationPoint[] = [
  { date: '2021-Q1', brentPriceUsd: 61.2, henryHubPriceUsd: 2.71, oilGasRatio: 22.6, regime: 'Normal' },
  { date: '2021-Q2', brentPriceUsd: 69.1, henryHubPriceUsd: 2.98, oilGasRatio: 23.2, regime: 'Normal' },
  { date: '2021-Q3', brentPriceUsd: 73.5, henryHubPriceUsd: 4.36, oilGasRatio: 16.9, regime: 'Gas Squeeze' },
  { date: '2021-Q4', brentPriceUsd: 79.6, henryHubPriceUsd: 5.83, oilGasRatio: 13.7, regime: 'Gas Squeeze' },
  { date: '2022-Q1', brentPriceUsd: 100.9, henryHubPriceUsd: 4.67, oilGasRatio: 21.6, regime: 'High Spread' },
  { date: '2022-Q2', brentPriceUsd: 113.8, henryHubPriceUsd: 7.49, oilGasRatio: 15.2, regime: 'Gas Squeeze' },
  { date: '2022-Q3', brentPriceUsd: 100.8, henryHubPriceUsd: 8.03, oilGasRatio: 12.6, regime: 'Gas Squeeze' },
  { date: '2022-Q4', brentPriceUsd: 88.6, henryHubPriceUsd: 6.09, oilGasRatio: 14.5, regime: 'Gas Squeeze' },
  { date: '2023-Q1', brentPriceUsd: 82.2, henryHubPriceUsd: 2.65, oilGasRatio: 31.0, regime: 'High Spread' },
  { date: '2023-Q2', brentPriceUsd: 78.3, henryHubPriceUsd: 2.16, oilGasRatio: 36.3, regime: 'High Spread' },
  { date: '2023-Q3', brentPriceUsd: 86.7, henryHubPriceUsd: 2.55, oilGasRatio: 34.0, regime: 'High Spread' },
  { date: '2023-Q4', brentPriceUsd: 83.9, henryHubPriceUsd: 2.87, oilGasRatio: 29.2, regime: 'Normal' },
  { date: '2024-Q1', brentPriceUsd: 83.0, henryHubPriceUsd: 2.24, oilGasRatio: 37.1, regime: 'High Spread' },
  { date: '2024-Q2', brentPriceUsd: 84.4, henryHubPriceUsd: 2.12, oilGasRatio: 39.8, regime: 'High Spread' },
  { date: '2024-Q3', brentPriceUsd: 79.9, henryHubPriceUsd: 2.28, oilGasRatio: 35.0, regime: 'High Spread' },
  { date: '2024-Q4', brentPriceUsd: 74.1, henryHubPriceUsd: 2.76, oilGasRatio: 26.8, regime: 'Normal' },
  // Additional high-resolution monthly points for rich scatter distribution
  { date: '2022-03', brentPriceUsd: 117.2, henryHubPriceUsd: 4.90, oilGasRatio: 23.9, regime: 'High Spread' },
  { date: '2022-05', brentPriceUsd: 113.3, henryHubPriceUsd: 8.14, oilGasRatio: 13.9, regime: 'Gas Squeeze' },
  { date: '2022-06', brentPriceUsd: 122.7, henryHubPriceUsd: 7.70, oilGasRatio: 15.9, regime: 'Gas Squeeze' },
  { date: '2022-08', brentPriceUsd: 100.5, henryHubPriceUsd: 8.81, oilGasRatio: 11.4, regime: 'Gas Squeeze' },
  { date: '2023-01', brentPriceUsd: 82.5, henryHubPriceUsd: 3.27, oilGasRatio: 25.2, regime: 'Normal' },
  { date: '2023-05', brentPriceUsd: 75.5, henryHubPriceUsd: 2.15, oilGasRatio: 35.1, regime: 'High Spread' },
  { date: '2023-09', brentPriceUsd: 93.7, henryHubPriceUsd: 2.64, oilGasRatio: 35.5, regime: 'High Spread' },
  { date: '2024-04', brentPriceUsd: 89.0, henryHubPriceUsd: 1.60, oilGasRatio: 55.6, regime: 'High Spread' },
  { date: '2024-07', brentPriceUsd: 85.3, henryHubPriceUsd: 2.07, oilGasRatio: 41.2, regime: 'High Spread' },
  { date: '2024-10', brentPriceUsd: 75.4, henryHubPriceUsd: 2.34, oilGasRatio: 32.2, regime: 'Normal' },
  { date: '2024-11', brentPriceUsd: 73.2, henryHubPriceUsd: 2.68, oilGasRatio: 27.3, regime: 'Normal' },
  { date: '2024-12', brentPriceUsd: 73.8, henryHubPriceUsd: 3.25, oilGasRatio: 22.7, regime: 'Normal' },
];

/**
 * 6. ExxonMobil (NYSE: XOM) Daily Stock Price (Full Active Trading Month - 22 Sessions)
 * Source: Yahoo Finance / NYSE Official Historical Quotes 2024
 * Format: [Open, Close, Lowest, Highest, Volume in Millions]
 */
export const XOM_DAILY_CANDLESTICK: StockCandlePoint[] = [
  { date: '2024-10-01', open: 118.25, close: 120.95, lowest: 117.80, highest: 121.40, volumeMillion: 18.4 },
  { date: '2024-10-02', open: 121.10, close: 122.35, lowest: 120.45, highest: 123.10, volumeMillion: 21.2 },
  { date: '2024-10-03', open: 122.50, close: 123.40, lowest: 121.90, highest: 124.05, volumeMillion: 19.8 },
  { date: '2024-10-04', open: 123.60, close: 124.15, lowest: 122.80, highest: 124.60, volumeMillion: 16.5 },
  { date: '2024-10-07', open: 124.80, close: 125.10, lowest: 123.95, highest: 125.75, volumeMillion: 20.3 },
  { date: '2024-10-08', open: 124.50, close: 122.85, lowest: 122.10, highest: 124.90, volumeMillion: 22.7 },
  { date: '2024-10-09', open: 122.40, close: 121.60, lowest: 120.80, highest: 122.95, volumeMillion: 17.9 },
  { date: '2024-10-10', open: 121.80, close: 122.25, lowest: 121.10, highest: 122.80, volumeMillion: 15.6 },
  { date: '2024-10-11', open: 122.50, close: 123.10, lowest: 121.95, highest: 123.50, volumeMillion: 14.8 },
  { date: '2024-10-14', open: 123.30, close: 122.40, lowest: 121.85, highest: 123.90, volumeMillion: 16.2 },
  { date: '2024-10-15', open: 121.50, close: 118.90, lowest: 118.30, highest: 121.95, volumeMillion: 25.1 },
  { date: '2024-10-16', open: 118.70, close: 119.45, lowest: 118.10, highest: 120.10, volumeMillion: 17.3 },
  { date: '2024-10-17', open: 119.80, close: 120.25, lowest: 119.20, highest: 120.85, volumeMillion: 14.9 },
  { date: '2024-10-18', open: 120.10, close: 119.70, lowest: 119.15, highest: 120.60, volumeMillion: 13.5 },
  { date: '2024-10-21', open: 119.50, close: 120.40, lowest: 118.90, highest: 120.80, volumeMillion: 15.2 },
  { date: '2024-10-22', open: 120.60, close: 121.20, lowest: 120.00, highest: 121.75, volumeMillion: 14.1 },
  { date: '2024-10-23', open: 120.90, close: 119.80, lowest: 119.25, highest: 121.30, volumeMillion: 16.7 },
  { date: '2024-10-24', open: 119.60, close: 120.55, lowest: 119.10, highest: 120.90, volumeMillion: 15.0 },
  { date: '2024-10-25', open: 120.80, close: 121.75, lowest: 120.20, highest: 122.10, volumeMillion: 17.6 },
  { date: '2024-10-28', open: 121.20, close: 119.60, lowest: 118.80, highest: 121.50, volumeMillion: 23.4 },
  { date: '2024-10-29', open: 119.40, close: 118.75, lowest: 118.10, highest: 119.95, volumeMillion: 19.5 },
  { date: '2024-10-30', open: 118.90, close: 119.30, lowest: 118.40, highest: 120.05, volumeMillion: 18.2 },
];

/**
 * 7. OPEC Reference Basket (ORB) Benchmark
 * Source: OPEC Secretariat Official Daily Quotation
 */
export const OPEC_BASKET_METRIC: OpecBasketMetric = {
  currentPrice: 74.85,
  prevPrice: 73.92,
  change: 0.93,
  changePct: 1.26,
  yearLow: 70.82,
  yearHigh: 92.60,
  targetBandMin: 70.0,
  targetBandMax: 85.0,
  date: '2024-12-20',
  components: [
    { name: 'Arab Light (Saudi Arabia)', gravityApi: 33.4, sulfurPct: 1.77 },
    { name: 'Basrah Medium (Iraq)', gravityApi: 27.9, sulfurPct: 3.00 },
    { name: 'Murban (UAE)', gravityApi: 40.5, sulfurPct: 0.74 },
    { name: 'Kuwait Export (Kuwait)', gravityApi: 30.5, sulfurPct: 2.60 },
    { name: 'Iran Heavy (Iran)', gravityApi: 29.5, sulfurPct: 2.10 },
    { name: 'Bonny Light (Nigeria)', gravityApi: 35.3, sulfurPct: 0.15 },
    { name: 'Es Sider (Libya)', gravityApi: 37.0, sulfurPct: 0.40 },
    { name: 'Saharan Blend (Algeria)', gravityApi: 44.0, sulfurPct: 0.10 },
  ],
};

/**
 * Metadata configuration for each of the 7 dashboard cards
 */
export const DASHBOARD_CHARTS_CONFIG: Record<string, ChartCardConfig> = {
  'brent-line': {
    id: 'brent-line',
    title: 'Brent Crude Spot Price (5-Year Trend)',
    titleAr: 'سعر خام برنت الشهري (مسار 5 سنوات)',
    category: 'Benchmark Commodities',
    unit: 'USD / Barrel ($/bbl)',
    source: 'U.S. Energy Information Administration (EIA)',
    sourceYear: '2020 - 2024',
    description: 'Monthly European Brent crude oil FOB spot price average reflecting international physical marker volatility.',
  },
  'opec-bar': {
    id: 'opec-bar',
    title: 'Top 8 OPEC Member Daily Crude Production',
    titleAr: 'إنتاج النفط اليومي لأبرز 8 دول أعضاء في أوبك',
    category: 'Global Supply & Quotas',
    unit: 'Million Barrels per Day (mb/d)',
    source: 'OPEC Annual Statistical Bulletin (ASB) & MOMR',
    sourceYear: '2024',
    description: 'Secondary sources crude output vs OPEC+ declared voluntary production quotas.',
  },
  'energy-donut': {
    id: 'energy-donut',
    title: 'Global Primary Energy Consumption Mix',
    titleAr: 'حصص مصادر الطاقة الأولية العالمية',
    category: 'Energy Transition Matrix',
    unit: 'Percentage of Total Mix (%)',
    source: 'Energy Institute (EI) Statistical Review of World Energy',
    sourceYear: '2024',
    description: 'Breakdown of primary energy consumption by fuel vector across world economies.',
  },
  'us-stocks-area': {
    id: 'us-stocks-area',
    title: 'U.S. Commercial Crude Oil Ending Stocks',
    titleAr: 'مخزونات النفط الخام التجارية الأمريكية الأسبوعية',
    category: 'Inventory & Storage Dynamics',
    unit: 'Million Barrels (mbbl)',
    source: 'EIA Weekly Petroleum Status Report (WPSR)',
    sourceYear: '2024',
    description: 'Weekly commercial crude inventories excluding Strategic Petroleum Reserve (SPR).',
  },
  'brent-gas-scatter': {
    id: 'brent-gas-scatter',
    title: 'Oil vs Natural Gas Price Parity & Spread',
    titleAr: 'العلاقة بين سعر برنت والغاز الطبيعي (Henry Hub)',
    category: 'Cross-Commodity Correlation',
    unit: 'Brent ($/bbl) vs Henry Hub ($/MMBtu)',
    source: 'U.S. Energy Information Administration (EIA)',
    sourceYear: '2021 - 2024',
    description: 'Empirical price scatter diagram mapping energy parity and LNG arbitrage dynamics.',
  },
  'xom-candlestick': {
    id: 'xom-candlestick',
    title: 'ExxonMobil Corp (NYSE: XOM) Daily OHLC',
    titleAr: 'أسعار أسهم إكسون موبيل اليومية (شموع يابانية)',
    category: 'Supermajor Equity Valuation',
    unit: 'Share Price (USD) & Volume (M)',
    source: 'Yahoo Finance / NYSE Official Market Data',
    sourceYear: '2024',
    description: 'Full monthly candlestick series featuring Open, High, Low, Close, and daily trading volumes.',
  },
  'orb-gauge': {
    id: 'orb-gauge',
    title: 'OPEC Reference Basket (ORB) Dial Meter',
    titleAr: 'مؤشر سلة خامات أوبك المرجعية (ORB)',
    category: 'Official Benchmark Index',
    unit: 'USD / Barrel ($/bbl)',
    source: 'OPEC Secretariat Official Pricing',
    sourceYear: '2024',
    description: 'Weighted average of petroleum blends produced by OPEC member states with target equilibrium band.',
  },
};
