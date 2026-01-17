import { Candle, CandleWithIndicators, StrategyParams, Trade, TradeStatus, TradeType } from "../types";

/**
 * Optimization
 */
export const optimizeStrategy = (history: Candle[]): StrategyParams => {
  return { riskRewardRatio: 2.5 };
};

/**
 * Simple EMA50/EMA200 Proximity Strategy
 */
export const checkSignal = (
  allCandles: CandleWithIndicators[],
  currentIndex: number,
  params: StrategyParams
) => {
  if (currentIndex < 200) return { type: 'NONE' };

  const curr = allCandles[currentIndex];
  const { ema50, ema200 } = curr.indicators;
  if (!ema50 || !ema200) return { type: 'NONE' };

  const entryPrice = curr.close;
  const threshold = ema200 * 0.002; // قريب من EMA200 بنسبة 0.2%

  // ================= BUY =================
  if (ema50 > ema200 && Math.abs(ema50 - ema200) <= threshold) {
    return {
      type: 'BUY',
      entryPrice,
      stopLoss: entryPrice * 0.99,    // SL = 1%
      takeProfit: entryPrice * 1.025, // TP = 2.5%
      reason: 'EMA50 Approaching EMA200 (Potential Golden Cross)',
      signalStrength: 8
    };
  }

  // ================= SELL =================
  if (ema50 < ema200 && Math.abs(ema50 - ema200) <= threshold) {
    return {
      type: 'SELL',
      entryPrice,
      stopLoss: entryPrice * 1.01,    // SL = 1%
      takeProfit: entryPrice * 0.975, // TP = 2.5%
      reason: 'EMA50 Approaching EMA200 (Potential Death Cross)',
      signalStrength: 8
    };
  }

  return { type: 'NONE' };
};

/**
 * Execute Trade without Trailing Stop
 */
export const executeTrade = (
  allCandles: CandleWithIndicators[],
  params: StrategyParams,
  currentBalance: number,
  activeTrade: Trade | null
): { action: 'NONE' | 'OPEN' | 'CLOSE', tradeDetails?: Partial<Trade> } => {

  const currentIndex = allCandles.length - 1;
  const currentCandle = allCandles[currentIndex];

  // إدارة الصفقة المفتوحة
  if (activeTrade && activeTrade.status === TradeStatus.OPEN) {
    const isBuy = activeTrade.type === TradeType.BUY;

    // Close SL
    if ((isBuy && currentCandle.low <= activeTrade.stopLoss) || (!isBuy && currentCandle.high >= activeTrade.stopLoss)) {
      const pnl = isBuy
        ? (activeTrade.stopLoss - activeTrade.entryPrice) / activeTrade.entryPrice * activeTrade.amount
        : (activeTrade.entryPrice - activeTrade.stopLoss) / activeTrade.entryPrice * activeTrade.amount;
      return {
        action: 'CLOSE',
        tradeDetails: {
          status: TradeStatus.CLOSED,
          exitPrice: activeTrade.stopLoss,
          exitTime: currentCandle.time,
          pnl,
          strategyUsed: 'Stop Loss'
        }
      };
    }

    // Close TP
    if ((isBuy && currentCandle.high >= activeTrade.takeProfit) || (!isBuy && currentCandle.low <= activeTrade.takeProfit)) {
      const pnl = isBuy
        ? (activeTrade.takeProfit - activeTrade.entryPrice) / activeTrade.entryPrice * activeTrade.amount
        : (activeTrade.entryPrice - activeTrade.takeProfit) / activeTrade.entryPrice * activeTrade.amount;
      return {
        action: 'CLOSE',
        tradeDetails: {
          status: TradeStatus.CLOSED,
          exitPrice: activeTrade.takeProfit,
          exitTime: currentCandle.time,
          pnl,
          strategyUsed: 'Take Profit'
        }
      };
    }

    return { action: 'NONE' };
  }

  // منع فتح صفقة جديدة إذا هناك صفقة مفتوحة
  if (activeTrade && activeTrade.status === TradeStatus.OPEN) return { action: 'NONE' };

  // فحص إشارة جديدة
  const signal = checkSignal(allCandles, currentIndex, params);
  if (signal.type !== 'NONE' && signal.entryPrice && signal.stopLoss && signal.takeProfit) {

    const isBuy = signal.type === 'BUY';
    const entryPrice = signal.entryPrice;
    const stopLoss = signal.stopLoss;
    const takeProfit = signal.takeProfit;

    const riskPerTrade = currentBalance * 0.015;
    const risk = Math.abs(entryPrice - stopLoss);
    let positionSize = (riskPerTrade / (risk / entryPrice));

    if (positionSize > currentBalance) positionSize = currentBalance * 0.95;
    if (positionSize < 10) positionSize = 10;

    return {
      action: 'OPEN',
      tradeDetails: {
        id: Math.random().toString(36).substr(2, 9),
        type: isBuy ? TradeType.BUY : TradeType.SELL,
        entryPrice,
        entryTime: currentCandle.time,
        amount: positionSize,
        stopLoss,
        initialStopLoss: stopLoss,
        takeProfit,
        status: TradeStatus.OPEN,
        strategyUsed: `${signal.reason || 'EMA50/EMA200 Proximity Strategy'} (قوة: ${signal.signalStrength || 0}/10)`,
      }
    };
  }

  return { action: 'NONE' };
};
