export default async function handler(req, res) {
  try {
    const { market, startDate, endDate } = req.query;
    const strategy = JSON.parse(req.query.strategy || '{}');

    if (!strategy.coin &&!strategy.stock) {
      return res.status(400).json({ success: false, error: 'Strategy data missing' });
    }

    if (market!== 'crypto') {
      return res.status(200).json({
        success: false,
        error: 'Stock backtest abhi ready nahi. Crypto test karo!'
      });
    }

    // STEP 1: CoinGecko se data lao - No restriction
    const coinId = strategy.coin.toLowerCase().replace('usdt', ''); // BTCUSDT -> btc
    const coinMap = { btc: 'bitcoin', eth: 'ethereum', bnb: 'binancecoin' };
    const geckoId = coinMap[coinId] || 'bitcoin';

    const fromTime = Math.floor(new Date(startDate).getTime() / 1000);
    const toTime = Math.floor(new Date(endDate).getTime() / 1000);

    // CoinGecko: 30 din ka hourly data free mein
    const url = `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart/range?vs_currency=usd&from=${fromTime}&to=${toTime}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.prices ||!Array.isArray(data.prices)) {
      return res.status(400).json({
        success: false,
        error: 'CoinGecko se data nahi mila. Coin name check karo ya date range kam karo.'
      });
    }

    if (data.prices.length === 0) {
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

    // STEP 2: CoinGecko data ko candle format mein convert karo
    const candles = data.prices.map(p => ({
      time: p[0],
      close: p[1],
      open: p[1], // CoinGecko hourly mein OHLC nahi deta, close hi use karo
      high: p[1],
      low: p[1]
    }));

    // STEP 3: Strategy run karo
    const signals = runStrategyOnCandles(candles, strategy);
    const results = calculatePL(signals);

    res.status(200).json({
      success: true,
      signals: signals.filter(s => s.type === 'SELL').length,
      winRate: results.winRate,
      totalPL: results.totalPL,
      bestTrade: results.bestTrade,
      trades: signals
    });

  } catch (error) {
    console.error('Backtest Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Helper Functions - Same as before
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
