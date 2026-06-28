export default async function handler(req, res) {
  try {
    const { market, strategyId, startDate, endDate } = req.query;
    
    // Step 1: Strategy data localStorage se nahi mil sakta backend mein
    // Isliye frontend se strategy details bhej denge
    const strategy = JSON.parse(req.query.strategy || '{}');
    
    if (!strategy.coin && !strategy.stock) {
      return res.status(400).json({ error: 'Strategy data missing' });
    }
    
    // Step 2: Historical data fetch karo
    let candles = [];
    const symbol = market === 'crypto' ? strategy.coin : strategy.stock;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    
    if (market === 'crypto') {
      // Binance se 5min candles
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=5m&startTime=${start}&endTime=${end}&limit=1000`;
      const data = await fetch(url).then(r => r.json());
      candles = data.map(d => ({
        time: d[0],
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5])
      }));
    } else {
      // Yahoo Finance se stocks data
      return res.json({ error: 'Stock backtest coming soon. Crypto test kar bhai!' });
    }
    
    // Step 3: Strategy run karo candles pe
    const signals = runStrategyOnCandles(candles, strategy);
    
    // Step 4: P/L calculate karo
    const results = calculatePL(signals);
    
    res.status(200).json({
      success: true,
      signals: signals.length,
      winRate: results.winRate,
      totalPL: results.totalPL,
      bestTrade: results.bestTrade,
      trades: signals
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Helper: Strategy Logic
function runStrategyOnCandles(candles, strat) {
  const emaFast = parseInt(strat.emaFast);
  const emaSlow = parseInt(strat.emaSlow);
  const rsiPeriod = parseInt(strat.rsiPeriod);
  const rsiLevel = parseInt(strat.rsiLevel);
  
  // Calculate EMA
  const emaFastArr = calcEMA(candles.map(c => c.close), emaFast);
  const emaSlowArr = calcEMA(candles.map(c => c.close), emaSlow);
  const rsiArr = calcRSI(candles.map(c => c.close), rsiPeriod);
  
  let signals = [];
  let position = null;
  
  for (let i = emaSlow; i < candles.length; i++) {
    const prevFast = emaFastArr[i-1];
    const prevSlow = emaSlowArr[i-1];
    const currFast = emaFastArr[i];
    const currSlow = emaSlowArr[i];
    const rsi = rsiArr[i];
    
    // BUY: EMA cross + RSI oversold
    if (!position && prevFast <= prevSlow && currFast > currSlow && rsi < rsiLevel) {
      position = { type: 'BUY', price: candles[i].close, time: candles[i].time };
      signals.push({ ...position, date: new Date(candles[i].time).toLocaleDateString('en-IN') });
    }
    
    // SELL: EMA cross down
    if (position && position.type === 'BUY' && prevFast >= prevSlow && currFast < currSlow) {
      const pl = ((candles[i].close - position.price) / position.price * 100).toFixed(2);
      signals.push({ 
        type: 'SELL', 
        price: candles[i].close, 
        time: candles[i].time,
        date: new Date(candles[i].time).toLocaleDateString('en-IN'),
        pl: parseFloat(pl)
      });
      position = null;
    }
  }
  
  return signals;
}

// Helper: EMA Calculator
function calcEMA(data, period) {
  const k = 2 / (period + 1);
  let ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i-1] * (1 - k));
  }
  return ema;
}

// Helper: RSI Calculator  
function calcRSI(data, period) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i-1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rsi = [100 - (100 / (1 + avgGain / avgLoss))];
  
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i-1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    rsi.push(100 - (100 / (1 + avgGain / avgLoss)));
  }
  
  return Array(period).fill(50).concat(rsi);
}

// Helper: P/L Calculator
function calculatePL(signals) {
  const trades = signals.filter(s => s.type === 'SELL' && s.pl !== undefined);
  if (trades.length === 0) return { winRate: 0, totalPL: 0, bestTrade: 0 };
  
  const wins = trades.filter(t => t.pl > 0).length;
  const totalPL = trades.reduce((sum, t) => sum + t.pl, 0);
  const bestTrade = Math.max(...trades.map(t => t.pl));
  
  return {
    winRate: Math.round(wins / trades.length * 100),
    totalPL: totalPL.toFixed(2),
    bestTrade: bestTrade.toFixed(2)
  };
}
