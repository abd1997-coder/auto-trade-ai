import { Candle, StrategyParams, CandleWithIndicators, MACD, CrossSignal } from "../types";

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

// MACD Calculation
export const calculateMACD = (
  data: Candle[], 
  fastPeriod: number = 12, 
  slowPeriod: number = 26, 
  signalPeriod: number = 9
): { macd: number[], signal: number[], histogram: number[] } => {
  if (data.length < slowPeriod + signalPeriod) {
    const empty = new Array(data.length).fill(NaN);
    return { macd: empty, signal: empty, histogram: empty };
  }

  // Calculate EMA for fast and slow periods
  const emaFast = calculateEMA(data, fastPeriod);
  const emaSlow = calculateEMA(data, slowPeriod);

  // Calculate MACD line (fast EMA - slow EMA)
  const macdLine: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (isNaN(emaFast[i]) || isNaN(emaSlow[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(emaFast[i] - emaSlow[i]);
    }
  }

  // Calculate Signal line (EMA of MACD line)
  // We need to convert MACD line to candle-like structure for EMA calculation
  const macdCandles: Candle[] = macdLine.map((value, i) => ({
    time: data[i].time,
    open: value,
    high: value,
    low: value,
    close: value,
    volume: 0
  }));

  const signalLine = calculateEMA(macdCandles, signalPeriod);

  // Calculate Histogram (MACD - Signal)
  const histogram: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalLine[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macdLine[i] - signalLine[i]);
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
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

// Determine trend based on EMA 50 and EMA 200
const determineTrend = (
  price: number,
  ema50: number | null,
  ema200: number | null,
  macd: MACD | null
): 'bullish' | 'bearish' | 'neutral' => {
  if (!ema50 || !ema200) return 'neutral';

  // Strong bullish: Price > EMA50 > EMA200 and MACD positive
  const priceAboveEma50 = price > ema50;
  const ema50AboveEma200 = ema50 > ema200;
  const macdBullish = macd && macd.macd !== null && macd.macd > 0;

  // Strong bearish: Price < EMA50 < EMA200 and MACD negative
  const priceBelowEma50 = price < ema50;
  const ema50BelowEma200 = ema50 < ema200;
  const macdBearish = macd && macd.macd !== null && macd.macd < 0;

  if (priceAboveEma50 && ema50AboveEma200 && macdBullish) return 'bullish';
  if (priceBelowEma50 && ema50BelowEma200 && macdBearish) return 'bearish';
  
  // Weak signals
  if (priceAboveEma50 && ema50AboveEma200) return 'bullish';
  if (priceBelowEma50 && ema50BelowEma200) return 'bearish';

  return 'neutral';
};

// Determine risk zone based on RSI and MACD divergence
const determineRiskZone = (
  rsi: number | null,
  macd: MACD | null,
  trend: 'bullish' | 'bearish' | 'neutral'
): 'low' | 'medium' | 'high' => {
  if (!rsi || !macd || !macd.macd || !macd.histogram) return 'medium';

  // High risk: Overbought/oversold with bearish MACD divergence
  if (trend === 'bullish' && rsi > 70 && macd.histogram < 0) return 'high';
  if (trend === 'bearish' && rsi < 30 && macd.histogram > 0) return 'high';

  // Medium risk: Extreme RSI levels
  if (rsi > 75 || rsi < 25) return 'medium';

  // Low risk: RSI in neutral zone with aligned MACD
  if (rsi >= 40 && rsi <= 60) {
    if (trend === 'bullish' && macd.histogram > 0) return 'low';
    if (trend === 'bearish' && macd.histogram < 0) return 'low';
  }

  return 'medium';
};

// Calculate average volume over a period
const calculateAverageVolume = (candles: Candle[], period: number = 20): number[] => {
  const avgVolumes: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      avgVolumes.push(NaN);
      continue;
    }
    
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].volume;
    }
    avgVolumes.push(sum / period);
  }
  
  return avgVolumes;
};

// Detect EMA cross (Golden Cross / Death Cross)
const detectCross = (
  ema50: number[],
  ema200: number[],
  currentIndex: number
): CrossSignal => {
  if (currentIndex < 1) {
    return { type: 'none', strength: 0, confirmed: false };
  }

  const prevEma50 = ema50[currentIndex - 1];
  const currEma50 = ema50[currentIndex];
  const prevEma200 = ema200[currentIndex - 1];
  const currEma200 = ema200[currentIndex];

  if (!prevEma50 || !currEma50 || !prevEma200 || !currEma200) {
    return { type: 'none', strength: 0, confirmed: false };
  }

  // Golden Cross: EMA 50 crosses above EMA 200
  const goldenCross = prevEma50 <= prevEma200 && currEma50 > currEma200;
  
  // Death Cross: EMA 50 crosses below EMA 200
  const deathCross = prevEma50 >= prevEma200 && currEma50 < currEma200;

  if (goldenCross) {
    // Calculate cross strength based on angle and distance
    const distance = currEma50 - currEma200;
    const prevDistance = Math.abs(prevEma50 - prevEma200);
    const strength = Math.min(10, Math.max(1, Math.round((distance / (currEma200 * 0.01)) * 5)));
    
    return { type: 'golden', strength, confirmed: true };
  }

  if (deathCross) {
    // Calculate cross strength
    const distance = currEma200 - currEma50;
    const strength = Math.min(10, Math.max(1, Math.round((distance / (currEma200 * 0.01)) * 5)));
    
    return { type: 'death', strength, confirmed: true };
  }

  // Check if we're in a confirmed cross state (not just crossing, but already crossed)
  if (currEma50 > currEma200) {
    // Already in golden cross state
    const distance = currEma50 - currEma200;
    const strength = Math.min(10, Math.max(1, Math.round((distance / (currEma200 * 0.01)) * 2)));
    return { type: 'golden', strength, confirmed: true };
  }

  if (currEma50 < currEma200) {
    // Already in death cross state
    const distance = currEma200 - currEma50;
    const strength = Math.min(10, Math.max(1, Math.round((distance / (currEma200 * 0.01)) * 2)));
    return { type: 'death', strength, confirmed: true };
  }

  return { type: 'none', strength: 0, confirmed: false };
};

// Check if market is sideways (consolidating)
const isMarketSideways = (
  candles: Candle[],
  currentIndex: number,
  lookback: number = 20
): boolean => {
  if (currentIndex < lookback) return false;

  const recentCandles = candles.slice(currentIndex - lookback, currentIndex + 1);
  const highs = recentCandles.map(c => c.high);
  const lows = recentCandles.map(c => c.low);
  
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const range = maxHigh - minLow;
  const avgPrice = recentCandles.reduce((sum, c) => sum + c.close, 0) / recentCandles.length;
  
  // Market is sideways if the range is less than 3% of average price
  const sidewaysThreshold = avgPrice * 0.03;
  
  return range < sidewaysThreshold;
};

// Determine volume trend
const determineVolumeTrend = (
  candles: Candle[],
  currentIndex: number,
  avgVolumes: number[]
): { trend: 'increasing' | 'decreasing' | 'neutral', ratio: number } => {
  if (currentIndex < 5 || !avgVolumes[currentIndex]) {
    return { trend: 'neutral', ratio: 1 };
  }

  const currentVolume = candles[currentIndex].volume;
  const avgVolume = avgVolumes[currentIndex];
  const ratio = currentVolume / avgVolume;

  // Compare with previous volumes
  if (currentIndex >= 5) {
    const recentVolumes = candles.slice(currentIndex - 5, currentIndex + 1).map(c => c.volume);
    const isIncreasing = recentVolumes[recentVolumes.length - 1] > recentVolumes[0] * 1.1;
    const isDecreasing = recentVolumes[recentVolumes.length - 1] < recentVolumes[0] * 0.9;

    if (isIncreasing && ratio > 1.2) {
      return { trend: 'increasing', ratio };
    }
    if (isDecreasing && ratio < 0.8) {
      return { trend: 'decreasing', ratio };
    }
  }

  return { trend: 'neutral', ratio };
};

export const enrichCandlesWithIndicators = (candles: Candle[], params: StrategyParams): CandleWithIndicators[] => {
  const ema50 = calculateEMA(candles, 50);
  const ema200 = calculateEMA(candles, 200);
  const rsi = calculateRSI(candles, 14);
  const macdData = calculateMACD(candles, 12, 26, 9);
  const atr = calculateATR(candles, 14);
  const avgVolumes = calculateAverageVolume(candles, 20);

  return candles.map((candle, i) => {
    const macd: MACD | null = 
      (macdData.macd[i] !== null && macdData.signal[i] !== null && macdData.histogram[i] !== null)
        ? {
            macd: macdData.macd[i],
            signal: macdData.signal[i],
            histogram: macdData.histogram[i]
          }
        : null;

    const trend = determineTrend(candle.close, ema50[i], ema200[i], macd);
    const riskZone = determineRiskZone(rsi[i], macd, trend);
    const crossSignal = detectCross(ema50, ema200, i);
    const isSideways = isMarketSideways(candles, i, 20);
    const volumeAnalysis = determineVolumeTrend(candles, i, avgVolumes);

    return {
      ...candle,
      indicators: {
        ema50: ema50[i] || null,
        ema200: ema200[i] || null,
        rsi: rsi[i] || null,
        macd: macd,
        atr: atr[i] || null,
        trend: trend,
        riskZone: riskZone,
        crossSignal: crossSignal,
        volumeTrend: volumeAnalysis.trend,
        volumeRatio: volumeAnalysis.ratio,
        isSideways: isSideways
      }
    };
  });
};