import { StrategyParams } from "./types";

export const INITIAL_BALANCE = 10000; // Simulated USDT
export const DEFAULT_SYMBOL = 'ETHUSDT';
export const DEFAULT_INTERVAL = '1h';
export const DEFAULT_RANGE_DAYS = 30; // Default lookback

export const AVAILABLE_SYMBOLS = [
  'BTCUSDT', 
  'ETHUSDT', 
  'BNBUSDT', 
  'SOLUSDT', 
  'XRPUSDT', 
  'ADAUSDT',
  'DOGEUSDT',
  'AVAXUSDT'
];

export const AVAILABLE_INTERVALS = [
  { label: '1 Minute', value: '1m' },
  { label: '5 Minutes', value: '5m' },
  { label: '15 Minutes', value: '15m' },
  { label: '1 Hour', value: '1h' },
  { label: '4 Hours', value: '4h' },
  { label: '1 Day', value: '1d' },
];

export const AVAILABLE_RANGES = [
  { label: '1 Week', days: 7 },
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 },
  { label: '1 Year', days: 365 },
];

// Professional Analyst Strategy Params (Trend Following)
export const DEFAULT_STRATEGY: StrategyParams = {
  riskRewardRatio: 3,
};

// Optimization Ranges for RSI filters
export const OPTIMIZATION_RANGES = {
  rsiBuyMin: [30], // Static
  rsiBuyMax: [65, 70, 75], // Optimize upper limit for buys
  rsiSellMin: [25, 30, 35], // Optimize lower limit for sells
  rsiSellMax: [70], // Static
};