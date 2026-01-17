
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
) => {

  if (currentIndex < 200) return { type: 'NONE' };

  const curr = allCandles[currentIndex];
  const { ema50, ema200, rsi } = curr.indicators;
  const prevRsi = allCandles[currentIndex - 1]?.indicators.rsi;

  if (!ema50 || !ema200 || !rsi || prevRsi === undefined) {
    return { type: 'NONE' };
  }

  const entryPrice = curr.close;

  // ================= BUY =================
  if (
    ema50 > ema200 &&             // ترند صاعد
    curr.close > ema50 &&         // فوق EMA 50
    prevRsi < 50 && rsi >= 50    // اختراق RSI 50
  ) {
    return {
      type: 'BUY',
      entryPrice,
      stopLoss: entryPrice * 0.99,    // 1% SL
      takeProfit: entryPrice * 1.015, // 1.5% TP
      reason: 'Trend Buy + RSI Break 50',
      signalStrength: 7
    };
  }

  // ================= SELL =================
  if (
    ema50 < ema200 &&             // ترند هابط
    curr.close < ema50 &&         // تحت EMA 50
    prevRsi > 50 && rsi <= 50    // اختراق RSI 50 للأسفل
  ) {
    return {
      type: 'SELL',
      entryPrice,
      stopLoss: entryPrice * 1.01,    // 1% SL
      takeProfit: entryPrice * 0.985, // 1.5% TP
      reason: 'Trend Sell + RSI Break 50',
      signalStrength: 7
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

  // منع فتح صفقة جديدة إذا كانت هناك صفقة مفتوحة بالفعل
  if (activeTrade && activeTrade.status === TradeStatus.OPEN) {
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
