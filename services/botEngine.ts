
import { Candle, CandleWithIndicators, StrategyParams, Trade, TradeStatus, TradeType, OrderBlock } from "../types";

/**
 * Basic Optimization: Returns a standard risk/reward ratio.
 */
export const optimizeStrategy = (history: Candle[]): StrategyParams => {
  // Simple logic: provide a standard 2.5 RR
  return { riskRewardRatio: 2.5 };
};

export const checkSignal = (
  allCandles: CandleWithIndicators[], 
  currentIndex: number, 
  params: StrategyParams
): { type: 'BUY' | 'SELL' | 'NONE', reason?: string, targetBlock?: OrderBlock } => {
  
  if (currentIndex < 200) return { type: 'NONE' };

  const curr = allCandles[currentIndex];
  const { ema200, rsi, activeBullishBlock, activeBearishBlock } = curr.indicators;

  if (!ema200 || !rsi) return { type: 'NONE' };

  // 1. Trend Filter
  const isTrendUp = curr.close > ema200;
  const isTrendDown = curr.close < ema200;

  // 2. SMC Logic
  const proximityBuffer = curr.close * 0.003; 

  if (isTrendUp && activeBullishBlock) {
      const nearZone = curr.low <= (activeBullishBlock.top + proximityBuffer);
      const validHold = curr.close >= activeBullishBlock.bottom; 
      if (nearZone && validHold) {
          return { type: 'BUY', reason: 'SMC Demand Retest', targetBlock: activeBullishBlock };
      }
  }

  if (isTrendDown && activeBearishBlock) {
      const nearZone = curr.high >= (activeBearishBlock.bottom - proximityBuffer);
      const validHold = curr.close <= activeBearishBlock.top;
      if (nearZone && validHold) {
          return { type: 'SELL', reason: 'SMC Supply Retest', targetBlock: activeBearishBlock };
      }
  }

  // 3. Fallback Trend Pullback
  if (isTrendUp && rsi < 45) return { type: 'BUY', reason: 'RSI Pullback' };
  if (isTrendDown && rsi > 55) return { type: 'SELL', reason: 'RSI Pullback' };

  return { type: 'NONE' };
};

export const executeTrade = (
  allCandles: CandleWithIndicators[],
  params: StrategyParams,
  currentBalance: number,
  activeTrade: Trade | null
): { action: 'NONE' | 'OPEN' | 'CLOSE', tradeDetails?: Partial<Trade> } => {
  
  const currentIndex = allCandles.length - 1;
  const currentCandle = allCandles[currentIndex];
  
  if (activeTrade && activeTrade.status === TradeStatus.OPEN) {
    const isBuy = activeTrade.type === TradeType.BUY;

    if ((isBuy && currentCandle.low <= activeTrade.stopLoss) || (!isBuy && currentCandle.high >= activeTrade.stopLoss)) {
         const pnl = isBuy 
            ? (activeTrade.stopLoss - activeTrade.entryPrice) / activeTrade.entryPrice * activeTrade.amount
            : (activeTrade.entryPrice - activeTrade.stopLoss) / activeTrade.entryPrice * activeTrade.amount;
         return { action: 'CLOSE', tradeDetails: { status: TradeStatus.CLOSED, exitPrice: activeTrade.stopLoss, exitTime: currentCandle.time, pnl, strategyUsed: 'SL Hit' } };
    }

    if ((isBuy && currentCandle.high >= activeTrade.takeProfit) || (!isBuy && currentCandle.low <= activeTrade.takeProfit)) {
        const pnl = isBuy 
            ? (activeTrade.takeProfit - activeTrade.entryPrice) / activeTrade.entryPrice * activeTrade.amount
            : (activeTrade.entryPrice - activeTrade.takeProfit) / activeTrade.entryPrice * activeTrade.amount;
        return { action: 'CLOSE', tradeDetails: { status: TradeStatus.CLOSED, exitPrice: activeTrade.takeProfit, exitTime: currentCandle.time, pnl, strategyUsed: 'TP Hit' } };
    }
    return { action: 'NONE' };
  }

  const signal = checkSignal(allCandles, currentIndex, params);

  if (signal.type !== 'NONE') {
      const isBuy = signal.type === 'BUY';
      const entryPrice = currentCandle.close;
      
      let stopLoss;
      if (signal.targetBlock) {
          const padding = (signal.targetBlock.top - signal.targetBlock.bottom) * 0.15;
          stopLoss = isBuy ? signal.targetBlock.bottom - padding : signal.targetBlock.top + padding;
      } else {
          const atr = currentCandle.indicators.atr || (entryPrice * 0.01);
          stopLoss = isBuy ? entryPrice - (atr * 1.5) : entryPrice + (atr * 1.5);
      }

      if (isBuy && stopLoss >= entryPrice) stopLoss = entryPrice * 0.995;
      if (!isBuy && stopLoss <= entryPrice) stopLoss = entryPrice * 1.005;

      const risk = Math.abs(entryPrice - stopLoss);
      const takeProfit = isBuy 
        ? entryPrice + (risk * params.riskRewardRatio) 
        : entryPrice - (risk * params.riskRewardRatio);

      const riskPerTrade = currentBalance * 0.015; // Risk 1.5%
      let positionSize = (riskPerTrade / (risk / entryPrice));

      if (positionSize > currentBalance) positionSize = currentBalance * 0.95;
      if (positionSize < 10) positionSize = 10;

      return {
          action: 'OPEN',
          tradeDetails: {
              id: Math.random().toString(36).substr(2, 9),
              type: isBuy ? TradeType.BUY : TradeType.SELL,
              entryPrice: entryPrice,
              entryTime: currentCandle.time,
              amount: positionSize,
              stopLoss: stopLoss,
              initialStopLoss: stopLoss,
              takeProfit: takeProfit,
              status: TradeStatus.OPEN,
              strategyUsed: signal.reason || 'SMC Strategy',
          }
      };
  }

  return { action: 'NONE' };
};
