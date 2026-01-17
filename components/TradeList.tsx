import React from 'react';
import { Trade, TradeStatus } from '../types';

interface Props {
  trades: Trade[];
}

const TradeList: React.FC<Props> = ({ trades }) => {
  // Calculate Statistics
  const closedTrades = trades.filter(t => t.status === TradeStatus.CLOSED);
  const totalClosed = closedTrades.length;
  const wins = closedTrades.filter(t => (t.pnl || 0) > 0).length;
  const losses = closedTrades.filter(t => (t.pnl || 0) <= 0).length;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header & Stats Dashboard */}
      <div className="bg-slate-800 border-b border-slate-700 p-3">
        <div className="font-semibold text-sm tracking-wide mb-3 flex justify-between items-center text-slate-200">
          <span>Performance</span>
          <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">
            {totalClosed > 0 ? `${Math.round((wins / totalClosed) * 100)}% Win Rate` : '0% WR'}
          </span>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center mb-1">
          <div className="bg-slate-900/80 rounded p-1.5 border border-slate-700">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Closed</div>
            <div className="font-mono font-bold text-white text-lg">{totalClosed}</div>
          </div>
          <div className="bg-emerald-950/40 rounded p-1.5 border border-emerald-900/50">
            <div className="text-[10px] text-emerald-500 uppercase font-bold">Wins</div>
            <div className="font-mono font-bold text-emerald-400 text-lg">{wins}</div>
          </div>
          <div className="bg-red-950/40 rounded p-1.5 border border-red-900/50">
            <div className="text-[10px] text-red-500 uppercase font-bold">Losses</div>
            <div className="font-mono font-bold text-red-400 text-lg">{losses}</div>
          </div>
        </div>
      </div>

      {/* List Area */}
      <div className="overflow-y-auto flex-1 p-2 space-y-2">
        {trades.length === 0 && (
          <div className="text-center text-slate-500 py-10 text-sm">
            No trades executed yet.<br/>Waiting for strategy signals...
          </div>
        )}
        {[...trades].reverse().map((trade) => (
          <div 
            key={trade.id} 
            className={`p-3 rounded border text-xs md:text-sm flex flex-col gap-1 ${
              trade.status === TradeStatus.OPEN 
                ? 'bg-slate-800 border-yellow-600/50 shadow-[0_0_10px_rgba(234,179,8,0.1)]' 
                : (trade.pnl && trade.pnl > 0 ? 'bg-emerald-950/20 border-emerald-900/60' : 'bg-red-950/20 border-red-900/60')
            }`}
          >
            <div className="flex justify-between items-center">
              <span className={`font-bold px-1.5 py-0.5 rounded ${trade.type === 'BUY' ? 'bg-emerald-900/80 text-emerald-300' : 'bg-red-900/80 text-red-300'}`}>
                {trade.type}
              </span>
            </div>
            
            <div className="flex justify-between mt-2 text-slate-300">
              <span>Entry: <span className="font-mono">{trade.entryPrice.toFixed(2)}</span></span>
              {trade.exitPrice && (
                 <span>Exit: <span className="font-mono">{trade.exitPrice.toFixed(2)}</span></span>
              )}
            </div>

            {/* تاريخ وساعة الدخول */}
            <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-700">
              <span className="text-[10px] text-slate-500">تاريخ الدخول</span>
              <span className="text-slate-400 font-mono text-[10px]">
                {new Date(trade.entryTime).toLocaleString('en-US', { 
                  year: 'numeric', 
                  month: '2-digit', 
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </span>
            </div>

            {/* تاريخ وساعة الخروج (للصفقات المغلقة فقط) */}
            {trade.status === TradeStatus.CLOSED && trade.exitTime && (
              <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-700">
                <span className="text-[10px] text-slate-500">تاريخ الخروج</span>
                <span className="text-slate-400 font-mono text-[10px]">
                  {new Date(trade.exitTime).toLocaleString('en-US', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
              </div>
            )}

            {trade.status === TradeStatus.CLOSED && trade.pnl !== undefined && (
              <div className={`flex justify-between items-center mt-1 pt-1 border-t ${trade.pnl >= 0 ? 'border-emerald-900/30' : 'border-red-900/30'}`}>
                <span className="text-[10px] text-slate-500">PnL</span>
                <span className={`font-bold font-mono ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)} USDT
                </span>
              </div>
            )}
             {trade.status === TradeStatus.OPEN && (
              <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-700">
                <span className="text-[10px] text-slate-500">Status</span>
                <span className="font-bold text-yellow-500 animate-pulse text-[10px]">
                  ● LIVE
                </span>
              </div>
            )}
            <div className="text-[9px] text-slate-600 mt-0.5 truncate">
               {trade.strategyUsed}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TradeList;