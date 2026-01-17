
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Square, RefreshCw, TrendingUp, Cpu, History, ChevronDown } from 'lucide-react';
import { fetchBinanceKlines } from './services/binanceService';
import { enrichCandlesWithIndicators } from './services/indicatorService';
import { optimizeStrategy, executeTrade } from './services/botEngine';
import { Candle, CandleWithIndicators, StrategyParams, Trade, TradeStatus, BotState } from './types';
import { 
  INITIAL_BALANCE, 
  DEFAULT_SYMBOL, 
  DEFAULT_STRATEGY, 
  DEFAULT_INTERVAL, 
  DEFAULT_RANGE_DAYS,
  AVAILABLE_SYMBOLS, 
  AVAILABLE_INTERVALS,
  AVAILABLE_RANGES 
} from './constants';
import MarketChart from './components/MarketChart';
import TradeList from './components/TradeList';
import IndicatorBadge from './components/IndicatorBadge';

const App: React.FC = () => {
  // Application State
  const [candles, setCandles] = useState<CandleWithIndicators[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategy, setStrategy] = useState<StrategyParams>(DEFAULT_STRATEGY);
  const [botState, setBotState] = useState<BotState>({
    isRunning: false,
    isTraining: false,
    balance: INITIAL_BALANCE,
    symbol: DEFAULT_SYMBOL,
    interval: DEFAULT_INTERVAL,
    historyDays: DEFAULT_RANGE_DAYS,
    lastTrainedAt: null,
  });
  
  // Replay State
  const [replayCount, setReplayCount] = useState(0);
  const totalReplayCandles = useRef(0);
  
  // Refs for loop management
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const candlesRef = useRef<CandleWithIndicators[]>([]); // Current visible candles
  const futureCandlesRef = useRef<Candle[]>([]); // Hidden real candles for replay
  const strategyRef = useRef<StrategyParams>(DEFAULT_STRATEGY);
  const activeTradeRef = useRef<Trade | null>(null);

  // Sync refs
  useEffect(() => { candlesRef.current = candles; }, [candles]);
  useEffect(() => { strategyRef.current = strategy; }, [strategy]);
  useEffect(() => { 
    const active = trades.find(t => t.status === TradeStatus.OPEN);
    activeTradeRef.current = active || null; 
  }, [trades]);

  // Helper: Convert interval string to minutes
  const getIntervalMinutes = (interval: string): number => {
    const num = parseInt(interval.slice(0, -1));
    const unit = interval.slice(-1);
    if (unit === 'm') return num;
    if (unit === 'h') return num * 60;
    if (unit === 'd') return num * 1440;
    return 60; // default 1h
  };

  // Initial Data Load
  const loadData = useCallback(async (symbol: string, interval: string, days: number) => {
    setBotState(prev => ({ ...prev, isTraining: true, isRunning: false }));
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTrades([]);
    setReplayCount(0);
    
    try {
      const intervalMinutes = getIntervalMinutes(interval);
      const totalMinutes = days * 24 * 60;
      let requiredCandles = Math.ceil(totalMinutes / intervalMinutes);
      
      // Add buffer for indicators
      requiredCandles += 250;

      if (requiredCandles > 20000) {
        requiredCandles = 20000;
      }

      const rawCandles = await fetchBinanceKlines(symbol, interval, requiredCandles);
      
      const historyCount = Math.min(Math.floor(rawCandles.length * 0.15), 1000);
      
      const historyData = rawCandles.slice(0, historyCount);
      const futureData = rawCandles.slice(historyCount);

      if (futureData.length === 0) {
        throw new Error("Not enough data fetched to simulate.");
      }

      futureCandlesRef.current = futureData;
      totalReplayCandles.current = futureData.length;

      const enriched = enrichCandlesWithIndicators(historyData, DEFAULT_STRATEGY);
      setCandles(enriched);
      
      const bestParams = optimizeStrategy(historyData);
      setStrategy(bestParams);
      setBotState(prev => ({ ...prev, lastTrainedAt: Date.now(), balance: INITIAL_BALANCE }));
      
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching Binance data.";
      alert(`⚠️ Error Loading Market Data\n\n${errorMessage}\n\nPlease check your internet connection and try again.`);
    } finally {
      setBotState(prev => ({ ...prev, isTraining: false }));
    }
  }, []);

  useEffect(() => {
    loadData(DEFAULT_SYMBOL, DEFAULT_INTERVAL, DEFAULT_RANGE_DAYS);
  }, [loadData]);

  const handleSymbolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSymbol = e.target.value;
    setBotState(prev => ({ ...prev, symbol: newSymbol }));
    loadData(newSymbol, botState.interval, botState.historyDays);
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newInterval = e.target.value;
    setBotState(prev => ({ ...prev, interval: newInterval }));
    loadData(botState.symbol, newInterval, botState.historyDays);
  };

  const handleHistoryRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDays = parseInt(e.target.value);
    setBotState(prev => ({ ...prev, historyDays: newDays }));
    loadData(botState.symbol, botState.interval, newDays);
  };

  const toggleBot = () => {
    if (botState.isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setBotState(prev => ({ ...prev, isRunning: false }));
    } else {
      if (futureCandlesRef.current.length === 0) {
        alert("Simulation finished!");
        return;
      }
      setBotState(prev => ({ ...prev, isRunning: true }));
      intervalRef.current = setInterval(tick, 40); 
    }
  };

  const tick = () => {
    const currentData = candlesRef.current;
    const nextRealCandle = futureCandlesRef.current.shift();

    if (!nextRealCandle) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setBotState(prev => ({ ...prev, isRunning: false }));
      return;
    }

    setReplayCount(prev => prev + 1);

    // RESTORED 2000 LIMIT: Maintain performance by slicing visible history
    const newData = [...currentData, nextRealCandle].slice(-2000); 
    const enrichedNewData = enrichCandlesWithIndicators(newData, strategyRef.current);
    
    setCandles(enrichedNewData);

    const decision = executeTrade(
      enrichedNewData, 
      strategyRef.current, 
      botState.balance, 
      activeTradeRef.current
    );

    if (decision.action === 'OPEN' && decision.tradeDetails) {
      const newTrade = decision.tradeDetails as Trade;
      setTrades(prev => [...prev, newTrade]);
      // تحديث activeTradeRef مباشرة لمنع فتح صفقة ثانية
      activeTradeRef.current = newTrade;
      setBotState(prev => ({ ...prev, balance: prev.balance - (newTrade.entryPrice * 0.0005) })); 

    } else if (decision.action === 'CLOSE') {
      const details = decision.tradeDetails!;
      
      if (details.status === TradeStatus.CLOSED) {
         setTrades(prev => prev.map(t => 
          t.status === TradeStatus.OPEN 
            ? { ...t, ...details } 
            : t
        ));
        // تحديث activeTradeRef مباشرة بعد إغلاق الصفقة
        activeTradeRef.current = null;
        const pnl = details.pnl || 0;
        setBotState(prev => ({ ...prev, balance: prev.balance + pnl }));
        
         if (replayCount % 100 === 0) { 
            const optimized = optimizeStrategy(newData.slice(-500));
            setStrategy(optimized);
            setBotState(prev => ({ ...prev, lastTrainedAt: Date.now() }));
        }
      }
    }
  };

  const totalPnLPercent = ((botState.balance - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;
  const progressPercent = (replayCount / (totalReplayCandles.current || 1)) * 100;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3 min-w-fit">
          <div className="bg-emerald-600 p-2 rounded-lg">
            <Cpu size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AutoTrade AI <span className="text-emerald-500">Simulator</span></h1>
            <p className="text-xs text-slate-400">Memory-Optimized Simulation</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 flex-1 justify-end">
           <div className="flex flex-wrap items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
              <div className="relative">
                <select 
                  value={botState.symbol} 
                  onChange={handleSymbolChange}
                  disabled={botState.isRunning}
                  className="appearance-none bg-slate-900 text-slate-200 text-xs font-bold py-1.5 pl-3 pr-8 rounded border border-slate-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
                >
                  {AVAILABLE_SYMBOLS.map(sym => (
                    <option key={sym} value={sym}>{sym}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <ChevronDown size={12} />
                </div>
              </div>

              <div className="relative">
                <select 
                  value={botState.interval} 
                  onChange={handleIntervalChange}
                  disabled={botState.isRunning}
                  className="appearance-none bg-slate-900 text-slate-200 text-xs font-bold py-1.5 pl-3 pr-8 rounded border border-slate-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
                >
                  {AVAILABLE_INTERVALS.map(int => (
                    <option key={int.value} value={int.value}>{int.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <ChevronDown size={12} />
                </div>
              </div>

               <div className="relative">
                <select 
                  value={botState.historyDays} 
                  onChange={handleHistoryRangeChange}
                  disabled={botState.isRunning}
                  className="appearance-none bg-slate-900 text-slate-200 text-xs font-bold py-1.5 pl-3 pr-8 rounded border border-slate-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
                >
                  {AVAILABLE_RANGES.map(rng => (
                    <option key={rng.label} value={rng.days}>{rng.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <ChevronDown size={12} />
                </div>
              </div>
           </div>

           <div className="hidden 2xl:block w-32">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>Progress</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
           </div>

          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-400 mb-1">Performance</div>
            <div className={`text-sm font-bold px-2 py-0.5 rounded ${totalPnLPercent >= 0 ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
               {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-400">Portfolio</div>
            <div className="text-xl font-mono font-bold text-white">
              ${botState.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <button 
            onClick={toggleBot}
            disabled={botState.isTraining}
            className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 ${
              botState.isRunning 
                ? 'bg-red-600 hover:bg-red-500 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {botState.isRunning ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            {botState.isRunning ? 'PAUSE' : 'START'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
               <History className="text-blue-500" size={20} />
               <div>
                 <div className="text-xs text-slate-500">Window</div>
                 <div className="font-bold text-xs md:text-sm">{botState.historyDays} Days</div>
               </div>
             </div>
             <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
               <RefreshCw className={`text-purple-500 ${botState.isTraining ? 'animate-spin' : ''}`} size={20} />
               <div>
                 <div className="text-xs text-slate-500">Optimization</div>
                 <div className="font-bold text-xs md:text-sm">{botState.isTraining ? 'Syncing...' : 'Ready'}</div>
               </div>
             </div>
             <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
               <TrendingUp className="text-emerald-500" size={20} />
               <div>
                 <div className="text-xs text-slate-500">Strategy</div>
                 <div className="font-bold text-xs md:text-sm">EMA Cross</div>
               </div>
             </div>
             <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
               <div className={`w-2 h-2 rounded-full ${candles.length > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
               <div>
                 <div className="text-xs text-slate-500">Live View</div>
                 <div className="font-bold text-xs md:text-sm">{candles.length} Candles</div>
               </div>
             </div>
          </div>

          <div className="flex-1 bg-slate-950 rounded-lg overflow-hidden min-h-[300px]">
            {candles.length > 0 ? (
              <MarketChart data={candles} trades={trades} />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 animate-pulse">
                Loading Market Data...
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
               <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                 <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                 Current Parameters
               </h3>
               {botState.lastTrainedAt && (
                 <span className="text-xs text-slate-500">Updated: {new Date(botState.lastTrainedAt).toLocaleTimeString()}</span>
               )}
            </div>
            <div className="flex flex-wrap gap-3">
              <IndicatorBadge label="Risk/Reward" value={`${strategy.riskRewardRatio.toFixed(1)}`} color="green" />
              <IndicatorBadge 
                label="Cross" 
                value={candles.length > 0 ? (
                  candles[candles.length - 1].indicators.crossSignal?.type === 'golden' ? 'Golden' :
                  candles[candles.length - 1].indicators.crossSignal?.type === 'death' ? 'Death' :
                  'None'
                ) : 'N/A'} 
                color={candles.length > 0 && candles[candles.length - 1].indicators.crossSignal?.type === 'golden' ? 'green' : 
                       candles.length > 0 && candles[candles.length - 1].indicators.crossSignal?.type === 'death' ? 'orange' : 'blue'} 
              />
              <IndicatorBadge 
                label="Signal Strength" 
                value={candles.length > 0 && candles[candles.length - 1].indicators.crossSignal?.strength 
                  ? `${candles[candles.length - 1].indicators.crossSignal.strength}/10` 
                  : 'N/A'} 
                color="purple" 
              />
              <IndicatorBadge 
                label="RSI" 
                value={candles.length > 0 ? (candles[candles.length - 1].indicators.rsi?.toFixed(1) || 'N/A') : 'N/A'} 
                color="orange" 
              />
              <IndicatorBadge 
                label="Volume" 
                value={candles.length > 0 ? (candles[candles.length - 1].indicators.volumeRatio?.toFixed(2) + 'x' || 'N/A') : 'N/A'} 
                color="blue" 
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 h-full overflow-hidden">
          <TradeList trades={trades} />
        </div>
      </main>
    </div>
  );
};

export default App;
