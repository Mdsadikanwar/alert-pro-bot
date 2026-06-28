export default async function handler(req, res) {
  try {
    const { market, strategyId, startDate, endDate } = req.query;
    const strategy = JSON.parse(req.query.strategy || '{}');

    if (!strategy.coin &&!strategy.stock) {
      return res.status(400).json({ success: false, error: 'Strategy data missing' });
    }

    let candles = [];
    const symbol = market === 'crypto'? strategy.coin : strategy.stock;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    if (market === 'crypto') {
      // Binance se 5min candles
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=5m&startTime=${start}&endTime=${end}&limit=1000`;
      const response = await fetch(url);
      const data = await response.json();

      // FIX: Check karo data array hai ya nahi
      if (!Array.isArray(data)) {
        console.log('Binance Error:', data);
        return res.status(400).json({
          success: false,
          error: data.msg || 'Binance se data nahi mila. Symbol ya date check karo.'
        });
      }

      if (data.length === 0) {
        return res.status(200).json({
          success: true,
          signals: 0,
          winRate: 0,
          totalPL: 0,
          bestTrade: 0,
          trades: [],
          message: 'Is date range mein koi data nahi mila'
        });
      }

      candles = data.map(d => ({
        time: d[0],
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5])
      }));

    } else {
      return res.status(200).json({
        success: false,
        error: 'Stock backtest abhi ready nahi. Crypto test karo bhai!'
      });
    }

    // Strategy run karo
    const signals = runStrategyOnCandles(candles, strategy);
    const results = calculatePL(signals);

    res.status(200).json({
      success: true,
      signals: signals.length,
      winRate: results.winRate,
      totalPL: results.totalPL,
      bestTrade: results.bestTrade,
      trades: signals.filter(s => s.type === 'SELL') // Sirf closed trades dikhao
    });

  } catch (error) {
    console.error('Backtest Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Helper: Strategy Logic
function runStrategyOnCandles(candles, strat) {
  const emaFast = parseInt(strat.emaFast);
  const emaSlow = parseInt(strat.emaSlow);
  const rsiPeriod = parseInt(strat.rsiPeriod);
  const rsiLevel = parseInt(strat.rsiLevel);

  if (candles.length < emaSlow + 5) return [];

  const emaFastArr = calcEMA(candles.map(c => c.close), emaFast);
  const emaSlowArr = calcEMA(candles.map(c => c.close), emaSlow);
  const rsiArr = calcRSI(candles.map(c => c.close), rsiPeriod);

  let signals = [];
  let position = null;

  for (let i = emaSlow; i < candles.length; i++) {
    if (!emaFastArr[i-1] ||!emaSlowArr[i-1] ||!rsiArr[i]) continue;

    const prevFast = emaFastArr[i-1];
    const prevSlow = emaSlowArr[i-1];
    const currFast = emaFastArr[i];
    const currSlow = emaSlowArr[i];
    const rsi = rsiArr[i];

    // BUY: EMA cross + RSI oversold
    if (!position && prevFast <= prevSlow && currFast > currSlow && rsi < rsiLevel) {
      position = { type: 'BUY', price: candles[i].close, time: candles[i].time };
      signals.push({
       ...position,
        date: new Date(candles[i].time).toLocaleDateString('en-IN')
      });
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

function calcEMA(data, period) {
  const k = 2 / (period + 1);
  let ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i-1] * (1 - k));
  }
  return ema;
}

function calcRSI(data, period) {
  if (data.length < period + 1) return Array(data.length).fill(50);

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
    avgGain = (avgGain * (period - 1) + (diff > 0? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0? -diff : 0)) / period;
    const rs = avgLoss === 0? 100 : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  return Array(period).fill(50).concat(rsi);
}

function calculatePL(signals) {
  const trades = signals.filter(s => s.type === 'SELL' && s.pl!== undefined);
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
