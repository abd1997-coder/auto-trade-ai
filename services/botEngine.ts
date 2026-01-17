
import { Candle, CandleWithIndicators, StrategyParams, Trade, TradeStatus, TradeType } from "../types";

/**
 * Basic Optimization: Returns a standard risk/reward ratio.
 */
export const optimizeStrategy = (history: Candle[]): StrategyParams => {
  // Simple logic: provide a standard 2.5 RR
  return { riskRewardRatio: 2.5 };
};

/**
 * استراتيجية تقاطع المتوسطات المتحركة - دخول مباشر بعد التقاطع
 * - يحدد نوع التقاطع (Golden Cross / Death Cross)
 * - يدخل الصفقة مباشرة بعد التقاطع دون أي شروط إضافية
 */
export const checkSignal = (
  allCandles: CandleWithIndicators[], 
  currentIndex: number, 
  params: StrategyParams
): { type: 'BUY' | 'SELL' | 'NONE', reason?: string, signalStrength?: number, entryPrice?: number, stopLoss?: number, takeProfit?: number } => {
  
  // نحتاج على الأقل 200 شمعة لحساب EMA 200
  if (currentIndex < 200) return { type: 'NONE' };

  const curr = allCandles[currentIndex];
  const { ema50, ema200, crossSignal } = curr.indicators;

  // التحقق من وجود المؤشرات الأساسية
  if (!ema50 || !ema200 || !crossSignal) {
    return { type: 'NONE' };
  }

  // 1. فحص تقاطع Golden Cross (إشارة شراء) - دخول مباشر
  if (crossSignal.type === 'golden' && crossSignal.confirmed) {
    // حساب نقاط الدخول والخروج
    const entryPrice = curr.close;
    
    // Stop Loss: أسفل EMA 200 أو أسفل أدنى نقطة حديثة
    const recentLow = Math.min(...allCandles.slice(Math.max(0, currentIndex - 10), currentIndex + 1).map(c => c.low));
    const stopLoss = entryPrice * 1.017;
    
    // Take Profit: تحقيق ربح 2% من سعر الدخول
    const takeProfit = entryPrice * 1.03;

    const reason = `Golden Cross: EMA 50 > EMA 200 (هدف: +2%)`;

    return {
      type: 'BUY',
      reason: reason,
      signalStrength: crossSignal.strength,
      entryPrice: entryPrice,
      stopLoss: stopLoss,
      takeProfit: takeProfit
    };
  }

  // 2. فحص تقاطع Death Cross (إشارة بيع) - دخول مباشر
  if (crossSignal.type === 'death' && crossSignal.confirmed) {
    // حساب نقاط الدخول والخروج
    const entryPrice = curr.close;
    
    // Stop Loss: أعلى EMA 200 أو أعلى أعلى نقطة حديثة
    const recentHigh = Math.max(...allCandles.slice(Math.max(0, currentIndex - 10), currentIndex + 1).map(c => c.high));
    const stopLoss = Math.max(ema200 * 1.005, recentHigh * 1.002);
    
    // Take Profit: تحقيق ربح 2% من سعر الدخول
    const takeProfit = entryPrice * 0.98;

    const reason = `Death Cross: EMA 50 < EMA 200 (هدف: +2%)`;

    return {
      type: 'SELL',
      reason: reason,
      signalStrength: crossSignal.strength,
      entryPrice: entryPrice,
      stopLoss: stopLoss,
      takeProfit: takeProfit
    };
  }

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
  
  // إغلاق الصفقة المفتوحة إذا تم الوصول إلى Stop Loss أو Take Profit
  if (activeTrade && activeTrade.status === TradeStatus.OPEN) {
    const isBuy = activeTrade.type === TradeType.BUY;

    // فحص Stop Loss
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

    // فحص Take Profit
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

  // فحص إشارة جديدة للدخول
  const signal = checkSignal(allCandles, currentIndex, params);

  if (signal.type !== 'NONE' && signal.entryPrice && signal.stopLoss && signal.takeProfit) {
      const isBuy = signal.type === 'BUY';
      const entryPrice = signal.entryPrice;
      const stopLoss = signal.stopLoss;
      const takeProfit = signal.takeProfit;

      // حساب حجم الصفقة بناءً على المخاطرة
      // مخاطرة 1.5% من الرصيد لكل صفقة
      const riskPerTrade = currentBalance * 0.015;
      const risk = Math.abs(entryPrice - stopLoss);
      
      // التأكد من أن المخاطرة منطقية
      if (risk <= 0 || risk > entryPrice * 0.1) {
        // إذا كانت المخاطرة غير منطقية، استخدم ATR كبديل
        const atr = currentCandle.indicators.atr || (entryPrice * 0.01);
        const adjustedRisk = atr * 1.5;
        const adjustedStopLoss = isBuy 
          ? entryPrice - adjustedRisk
          : entryPrice + adjustedRisk;
        const adjustedTakeProfit = isBuy
          ? entryPrice + (adjustedRisk * params.riskRewardRatio)
          : entryPrice - (adjustedRisk * params.riskRewardRatio);
        
        const adjustedRiskAmount = Math.abs(entryPrice - adjustedStopLoss);
        let positionSize = (riskPerTrade / (adjustedRiskAmount / entryPrice));
        
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
            stopLoss: adjustedStopLoss,
            initialStopLoss: adjustedStopLoss,
            takeProfit: adjustedTakeProfit,
            status: TradeStatus.OPEN,
            strategyUsed: `${signal.reason || 'EMA Cross Strategy'} (قوة: ${signal.signalStrength || 0}/10)`,
          }
        };
      }

      // حساب حجم الصفقة بناءً على المخاطرة المحددة
      let positionSize = (riskPerTrade / (risk / entryPrice));

      // حدود حجم الصفقة
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
              strategyUsed: `${signal.reason || 'EMA Cross Strategy'} (قوة: ${signal.signalStrength || 0}/10)`,
          }
      };
  }

  return { action: 'NONE' };
};
