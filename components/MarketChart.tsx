
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
      return (
        <div className="bg-slate-800 border border-slate-600 p-3 rounded shadow-xl text-xs font-mono min-w-[160px] z-50">
          <p className="text-slate-200 font-bold border-b border-slate-600 pb-2 mb-2 text-center">
            {new Date(label).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="space-y-1">
             <div className="flex justify-between">
              <span className="text-slate-400">Price:</span>
              <span className="text-white font-bold">{d.close.toFixed(2)}</span>
            </div>
             <div className="flex justify-between">
              <span className="text-yellow-600">EMA200:</span>
              <span className="text-yellow-400">{d.indicators.ema200?.toFixed(2)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const lastCandle = displayData[displayData.length - 1];
  const activeBullish = lastCandle?.indicators.activeBullishBlock;
  const activeBearish = lastCandle?.indicators.activeBearishBlock;

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <div className="flex-1 min-h-[400px] bg-slate-900 rounded-lg border border-slate-700 p-2 relative">
         <div className="absolute top-2 left-2 z-10 flex gap-2">
            <span className="text-[10px] text-yellow-500 font-bold uppercase">EMA 200</span>
            <span className="text-[10px] text-blue-500 font-bold uppercase">Demand</span>
            <span className="text-[10px] text-red-500 font-bold uppercase">Supply</span>
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

            {activeBullish && (
                <ReferenceArea 
                    y1={activeBullish.bottom} 
                    y2={activeBullish.top} 
                    fill="#3b82f6" 
                    fillOpacity={0.15} 
                    stroke="#3b82f6"
                    strokeDasharray="2 2"
                />
            )}
            {activeBearish && (
                <ReferenceArea 
                    y1={activeBearish.bottom} 
                    y2={activeBearish.top} 
                    fill="#ef4444" 
                    fillOpacity={0.15} 
                    stroke="#ef4444"
                    strokeDasharray="2 2"
                />
            )}

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
