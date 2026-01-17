
import React from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea
} from 'recharts';
import { CandleWithIndicators, Trade } from '../types';

interface Props {
  data: CandleWithIndicators[];
  trades: Trade[];
}

const MarketChart: React.FC<Props> = ({ data, trades }) => {
  // Reverted display window to 120 candles for a more standard focused view
  const displayData = data.slice(-120);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const indicators = d.indicators;
      return (
        <div className="bg-slate-800 border border-slate-600 p-3 rounded shadow-xl text-xs font-mono min-w-[200px] z-50">
          <p className="text-slate-200 font-bold border-b border-slate-600 pb-2 mb-2 text-center">
            {new Date(label).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="space-y-1">
             <div className="flex justify-between">
              <span className="text-slate-400">Price:</span>
              <span className="text-white font-bold">{d.close.toFixed(2)}</span>
            </div>
             <div className="flex justify-between">
              <span className="text-blue-400">EMA 50:</span>
              <span className="text-blue-300">{indicators.ema50?.toFixed(2) || 'N/A'}</span>
            </div>
             <div className="flex justify-between">
              <span className="text-yellow-600">EMA 200:</span>
              <span className="text-yellow-400">{indicators.ema200?.toFixed(2) || 'N/A'}</span>
            </div>
             <div className="flex justify-between">
              <span className="text-purple-400">RSI:</span>
              <span className={`font-bold ${
                indicators.rsi && indicators.rsi > 70 ? 'text-red-400' :
                indicators.rsi && indicators.rsi < 30 ? 'text-green-400' :
                'text-purple-300'
              }`}>
                {indicators.rsi?.toFixed(2) || 'N/A'}
              </span>
            </div>
            {indicators.macd && (
              <>
                <div className="flex justify-between">
                  <span className="text-cyan-400">MACD:</span>
                  <span className={`${indicators.macd.macd && indicators.macd.macd > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {indicators.macd.macd?.toFixed(4) || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyan-400">Signal:</span>
                  <span className="text-cyan-300">{indicators.macd.signal?.toFixed(4) || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyan-400">Histogram:</span>
                  <span className={`${indicators.macd.histogram && indicators.macd.histogram > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {indicators.macd.histogram?.toFixed(4) || 'N/A'}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-600 mt-1">
              <span className="text-slate-400">Cross:</span>
              <span className={`font-bold ${
                indicators.crossSignal?.type === 'golden' ? 'text-green-400' :
                indicators.crossSignal?.type === 'death' ? 'text-red-400' :
                'text-slate-400'
              }`}>
                {indicators.crossSignal?.type === 'golden' ? 'Golden Cross' :
                 indicators.crossSignal?.type === 'death' ? 'Death Cross' :
                 'None'}
                {indicators.crossSignal?.strength ? ` (${indicators.crossSignal.strength}/10)` : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Trend:</span>
              <span className={`font-bold ${
                indicators.trend === 'bullish' ? 'text-green-400' :
                indicators.trend === 'bearish' ? 'text-red-400' :
                'text-slate-400'
              }`}>
                {indicators.trend?.toUpperCase() || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Volume:</span>
              <span className={`font-bold ${
                indicators.volumeTrend === 'increasing' ? 'text-green-400' :
                indicators.volumeTrend === 'decreasing' ? 'text-red-400' :
                'text-slate-400'
              }`}>
                {indicators.volumeTrend?.toUpperCase() || 'N/A'} ({indicators.volumeRatio?.toFixed(2) || '1.00'}x)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Risk:</span>
              <span className={`font-bold ${
                indicators.riskZone === 'low' ? 'text-green-400' :
                indicators.riskZone === 'medium' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {indicators.riskZone?.toUpperCase() || 'N/A'}
              </span>
            </div>
            {indicators.isSideways && (
              <div className="flex justify-between pt-1 border-t border-slate-600 mt-1">
                <span className="text-orange-400 font-bold">⚠️ Sideways Market</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <div className="flex-1 min-h-[400px] bg-slate-900 rounded-lg border border-slate-700 p-2 relative">
         <div className="absolute top-2 left-2 z-10 flex gap-2 flex-wrap">
            <span className="text-[10px] text-blue-400 font-bold uppercase">EMA 50</span>
            <span className="text-[10px] text-yellow-500 font-bold uppercase">EMA 200</span>
            <span className="text-[10px] text-white font-bold uppercase">Price</span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis 
              dataKey="time" 
              tickFormatter={(tick) => new Date(tick).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
              stroke="#475569"
              fontSize={9}
              hide
            />
            <YAxis 
              domain={['auto', 'auto']} 
              orientation="right" 
              stroke="#475569"
              fontSize={10}
              tickFormatter={(val) => val.toFixed(0)}
            />
            <Tooltip content={<CustomTooltip />} isAnimationActive={false} />

            <Line 
              type="monotone" 
              dataKey="indicators.ema50" 
              stroke="#60a5fa" 
              strokeWidth={1.5} 
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line 
              type="monotone" 
              dataKey="indicators.ema200" 
              stroke="#eab308" 
              strokeWidth={1.5} 
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />

            <Line 
              type="monotone" 
              dataKey="close" 
              stroke="#f8fafc" 
              strokeWidth={2} 
              dot={false}
              isAnimationActive={false}
            />

          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MarketChart;
