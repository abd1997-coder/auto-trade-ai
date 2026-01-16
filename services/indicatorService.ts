import { Candle, StrategyParams, CandleWithIndicators, OrderBlock } from "../types";

// Standard EMA
export const calculateEMA = (data: Candle[], period: number): number[] => {
  if (data.length < period) return new Array(data.length).fill(NaN);

  const k = 2 / (period + 1);
  const emaArray: number[] = [];
  
  let sum = 0;
  // Safety: Check if data exists at index
  for (let i = 0; i < period; i++) {
    if (data[i]) sum += data[i].close;
  }
  let prevEma = sum / period;

  for (let i = 0; i < period - 1; i++) emaArray.push(NaN);
  emaArray.push(prevEma);

  for (let i = period; i < data.length; i++) {
    const currentEma = data[i].close * k + prevEma * (1 - k);
    emaArray.push(currentEma);
    prevEma = currentEma;
  }
  return emaArray;
};

// RSI Calculation
export const calculateRSI = (data: Candle[], period: number = 14): number[] => {
  if (data.length <= period) return new Array(data.length).fill(NaN);

  const rsiArray: number[] = [];
  const changes: number[] = [];

  for (let i = 1; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close);
  }

  let gains = 0;
  let losses = 0;

  // Initial Average
  for (let i = 0; i < period; i++) {
    if (changes[i] === undefined) break; 
    if (changes[i] > 0) gains += changes[i];
    else losses += Math.abs(changes[i]);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Fill initial NaN
  for (let i = 0; i < period; i++) rsiArray.push(NaN);

  // First RSI
  let rs = avgGain / (avgLoss || 1); // Avoid div by zero
  rsiArray.push(100 - (100 / (1 + rs)));

  // Smoothed RSI
  for (let i = period + 1; i < data.length; i++) {
    const change = changes[i - 1];
    if (change === undefined) {
        rsiArray.push(NaN);
        continue;
    }
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;

    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;

    rs = avgGain / (avgLoss || 0.00001);
    rsiArray.push(100 - (100 / (1 + rs)));
  }

  return rsiArray;
};

// Standard ATR
export const calculateATR = (data: Candle[], period: number = 14): number[] => {
  if (data.length <= period) return new Array(data.length).fill(NaN);

  const tr: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      tr.push(data[i].high - data[i].low);
      continue;
    }
    const highLow = data[i].high - data[i].low;
    const highClose = Math.abs(data[i].high - data[i-1].close);
    const lowClose = Math.abs(data[i].low - data[i-1].close);
    tr.push(Math.max(highLow, highClose, lowClose));
  }

  const atr: number[] = [];
  let sum = 0;
  for(let i=0; i<period; i++) sum += tr[i] || 0;
  let prevAtr = sum / period;
  
  for(let i=0; i<period-1; i++) atr.push(NaN);
  atr.push(prevAtr);

  for(let i=period; i<data.length; i++) {
    const currentAtr = (prevAtr * (period - 1) + (tr[i] || 0)) / period;
    atr.push(currentAtr);
    prevAtr = currentAtr;
  }
  return atr;
};

// --- INSTITUTIONAL ORDER BLOCK DETECTION ---
const identifyOrderBlocks = (candles: Candle[], atr: number[]): { bullish: OrderBlock[], bearish: OrderBlock[] } => {
    const bullishBlocks: OrderBlock[] = [];
    const bearishBlocks: OrderBlock[] = [];
    
    // We iterate through history to find Imbalance/Impulse moves
    for (let i = 20; i < candles.length - 2; i++) { // Look ahead slightly
        const currentATR = atr[i];
        if (!currentATR || isNaN(currentATR)) continue;

        const candle = candles[i];
        const nextCandle = candles[i+1];

        if (!candle || !nextCandle) continue;

        // RELAXED THRESHOLD: 0.8 * ATR instead of 1.5 * ATR to find more zones
        const impulseThreshold = currentATR * 0.8;

        // 1. Identify Bullish Order Block (Demand)
        const isBullishImpulse = 
            nextCandle.close > nextCandle.open && // Green
            (nextCandle.close - nextCandle.open) > impulseThreshold && // Decent body
            nextCandle.close > candle.high; // Break structure locally
        
        if (isBullishImpulse) {
             bullishBlocks.push({
                 top: candle.high,
                 bottom: candle.low,
                 type: 'bullish',
                 isMitigated: false,
                 creationTime: candle.time
             });
        }

        // 2. Identify Bearish Order Block (Supply)
        const isBearishImpulse = 
            nextCandle.open > nextCandle.close && // Red
            (nextCandle.open - nextCandle.close) > impulseThreshold && // Decent body
            nextCandle.close < candle.low; // Break structure locally

        if (isBearishImpulse) {
            bearishBlocks.push({
                top: candle.high,
                bottom: candle.low,
                type: 'bearish',
                isMitigated: false,
                creationTime: candle.time
            });
        }
    }
    return { bullish: bullishBlocks, bearish: bearishBlocks };
};

export const enrichCandlesWithIndicators = (candles: Candle[], params: StrategyParams): CandleWithIndicators[] => {
  const ema200 = calculateEMA(candles, 200);
  const rsi = calculateRSI(candles, 14);
  const atr = calculateATR(candles, 14);

  // Identify all historical Order Blocks
  const { bullish, bearish } = identifyOrderBlocks(candles, atr);

  return candles.map((candle, i) => {
    // Determine active zones for THIS specific point in time
    const relevantBullish = bullish.filter(b => b.creationTime < candle.time);
    const relevantBearish = bearish.filter(b => b.creationTime < candle.time);

    // Find the closest valid (unbroken) blocks
    let activeBullishBlock: OrderBlock | null = null;
    let activeBearishBlock: OrderBlock | null = null;

    // Filter valid Bullish Blocks: Price must be ABOVE them
    const validBullish = relevantBullish.filter(b => candle.close > b.bottom);
    if (validBullish.length > 0) {
        // Sort by time desc (most recent)
        activeBullishBlock = validBullish.sort((a, b) => b.creationTime - a.creationTime)[0]; 
    }

    // Filter valid Bearish Blocks: Price must be BELOW them
    const validBearish = relevantBearish.filter(b => candle.close < b.top);
    if (validBearish.length > 0) {
        // Sort by time desc (most recent)
        activeBearishBlock = validBearish.sort((a, b) => b.creationTime - a.creationTime)[0];
    }

    return {
      ...candle,
      indicators: {
        ema200: ema200[i] || null,
        rsi: rsi[i] || null,
        atr: atr[i] || null,
        activeBullishBlock: activeBullishBlock || null,
        activeBearishBlock: activeBearishBlock || null,
        marketStructure: (ema200[i] && candle.close > ema200[i]) ? 'bullish' : 'bearish'
      }
    };
  });
};