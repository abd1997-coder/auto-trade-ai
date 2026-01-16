import { Candle } from "../types";

export const fetchBinanceKlines = async (symbol: string, interval: string, totalLimit: number = 1000): Promise<Candle[]> => {
  try {
    const candles: Candle[] = [];
    let remaining = totalLimit;
    let endTime: number | undefined = undefined;

    // Safety: prevent too many API calls. 
    // Increased to 50 to allow fetching ~50,000 candles
    let safetyCounter = 0;
    const maxRequests = 50; 

    const BASE_URL = "https://api.binance.com/api/v3/klines";

    while (remaining > 0 && safetyCounter < maxRequests) {
      const limit = Math.min(remaining, 1000); 
      
      const targetUrl = `${BASE_URL}?symbol=${symbol}&interval=${interval}&limit=${limit}${endTime ? `&endTime=${endTime}` : ''}`;
      
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Binance API Error (${response.status}): ${errorText || response.statusText}`);
      }

      let rawData: any;
      try {
        rawData = await response.json();
      } catch (jsonError) {
        const text = await response.text();
        throw new Error(`Invalid response from Binance API: ${text.substring(0, 200)}`);
      }

      // Check if response is an error object
      if (rawData && typeof rawData === 'object' && 'code' in rawData) {
        const errorMsg = rawData.msg || JSON.stringify(rawData);
        throw new Error(`Binance API Error: ${errorMsg}`);
      }

      if (!Array.isArray(rawData) || rawData.length === 0) {
        if (safetyCounter === 0) {
          throw new Error(`No data received from Binance API. The symbol "${symbol}" or interval "${interval}" may be invalid.`);
        }
        break;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsedChunk: Candle[] = rawData.map((d: any) => ({
        time: d[0],
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
      }));

      // Sort ensuring time order if needed, but Binance returns old->new
      // We prepend because we are fetching backwards (endTime)
      candles.unshift(...parsedChunk);
      
      endTime = parsedChunk[0].time - 1;
      remaining -= parsedChunk.length;
      safetyCounter++;

      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (candles.length === 0) {
      throw new Error(`No data received from Binance API for ${symbol} (${interval}). Please verify the symbol and interval are correct.`);
    }
    return candles;

  } catch (error) {
    console.error("Failed to fetch from Binance:", error);
    // If error is already a detailed Error, re-throw it as-is
    if (error instanceof Error) {
      if (error.message.includes("Binance API") || error.message.includes("Network error")) {
        throw error;
      }
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Failed to fetch Binance data: ${errorMessage}`);
  }
};