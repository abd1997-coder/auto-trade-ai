export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MACD {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface CrossSignal {
  type: 'golden' | 'death' | 'none';
  strength: number; // 1-10
  confirmed: boolean;
}

export interface Indicators {
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  macd: MACD | null;
  atr: number | null;
  // Trend and risk analysis
  trend: 'bullish' | 'bearish' | 'neutral';
  riskZone: 'low' | 'medium' | 'high';
  // Cross analysis
  crossSignal: CrossSignal;
  volumeTrend: 'increasing' | 'decreasing' | 'neutral';
  volumeRatio: number; // Current volume / Average volume
  isSideways: boolean; // السوق عرضي
}

export interface CandleWithIndicators extends Candle {
  indicators: Indicators;
}

export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum TradeStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

export interface Trade {
  id: string;
  type: TradeType;
  entryPrice: number;
  entryTime: number;
  stopLoss: number;
  initialStopLoss: number; 
  takeProfit: number;
  amount: number; // In USDT
  pnl?: number; 
  exitPrice?: number;
  exitTime?: number;
  status: TradeStatus;
  strategyUsed: string;
}

export interface StrategyParams {
  riskRewardRatio: number;
}

export interface BotState {
  isRunning: boolean;
  isTraining: boolean;
  balance: number;
  symbol: string;
  interval: string;
  historyDays: number;
  lastTrainedAt: number | null;
}