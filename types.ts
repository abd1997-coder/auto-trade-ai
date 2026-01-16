export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBlock {
  top: number;
  bottom: number;
  type: 'bullish' | 'bearish';
  isMitigated: boolean;
  creationTime: number;
}

export interface Indicators {
  ema200: number | null;
  rsi: number | null;
  atr: number | null;
  // SMC Indicators
  activeBullishBlock: OrderBlock | null; // Nearest valid demand zone
  activeBearishBlock: OrderBlock | null; // Nearest valid supply zone
  marketStructure: 'bullish' | 'bearish' | 'consolidation';
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