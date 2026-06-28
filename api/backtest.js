export default async function handler(req, res) {
  try {
    const { market, startDate, endDate } = req.query;
    const strategy = JSON.parse(req.query.strategy || '{}');

    if (!strategy.coin) {
      return res.status(400).json({ success: false, error: 'Strategy data missing' });
    }

    if (market!== 'crypto') {
      return res.status(200).json({
        success: false,
        error: 'Stock backtest abhi ready nahi.'
      });
    }

    const coinId = strategy.coin.toLowerCase().replace('usdt', '');
    const coinMap = { btc: 'bitcoin', eth: 'ethereum', bnb: 'binancecoin' };
    const geckoId = coinMap[coinId] || 'bitcoin';

    const fromTime = Math.floor(new Date(startDate).getTime() / 1000);
    const toTime = Math.floor(new Date(endDate).getTime() / 1000);

    const url = `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart/range?vs_currency=usd&from=${fromTime}&to=${toTime}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.prices || data.prices.length === 0) {
      return res.status(200).json({
        success: true, signals: 0, winRate: 0, totalPL: 0, bestTrade: 0,
        trades: [], message: 'Is date range mein data nahi mila'
      });
    }

    const candles = data.prices.map(p => ({
      time: p[0], close: p[1], open: p[1], high: p[1], low: p[1]
    }));

    const signals = runStrategyWithSLTP(candles, strategy);
    const results = calculatePLWithSLTP(signals);

    res.status(200).json({
      success: true,
      signals: results.totalTrades,
      winRate: results.winRate,
      totalPL: results.totalPL,
      bestTrade: results.bestTrade,
      slHits: results.slHits,
      tpHits: results.tpHits,
      trades: signals
    });

  } catch (error) {
    console.error('Backtest Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

function runStrategyWithSLTP(candles, strat) {
  const emaFast = parseInt(strat.emaFast);
  const emaSlow = parseInt(strat.emaSlow);
  const rsiPeriod = parseInt(strat.rsiPeriod);
  const rsiLevel = parseInt(strat.rsiLevel);
  const slPercent = parseFloat(strat.stopLoss || 2);
  const tpPercent = parseFloat(strat.takeProfit || 4);

  if (candles.length < emaSlow + 5) return [];

  const closes = candles.map(c => c.close);
  const emaFastArr = calcEMA(closes, emaFast);
  const emaSlowArr = calcEMA(closes, emaSlow);
  const rsiArr = calcRSI(closes, rsiPeriod);

  let trades = [];
  let position = null;

  for (let i = emaSlow; i < candles.length; i++) {
    if (!emaFastArr[i-1] ||!emaSlowArr[i-1] ||!rsiArr[i]) continue;

    const price = candles[i].close;
    const prevFast = emaFastArr[i-1];
    const prevSlow = emaSlowArr[i-1];
    const currFast = emaFastArr[i];
    const currSlow = emaSlowArr[i];
    const rsi = rsiArr[i];

    if (position) {
      const slPrice = position.entry * (1 - slPercent / 100);
      const tpPrice = position.entry * (1 + tpPercent / 100);

      if (price <= slPrice) {
        trades.push({
          type: 'SELL', price: slPrice,
          time: candles[i].time,
          date: new Date(candles[i].time).toLocaleDateString('en-IN'),
          pl: -slPercent, exitReason: 'SL'
        });
        position = null;
        continue;
      }
      
      if (price >= tpPrice) {
        trades.push({
          type: 'SELL', price: tpPrice,
          time: candles[i].time,
          date: new Date(candles[i].time).toLocaleDateString('en-IN'),
          pl: tpPercent, exitReason: 'TP'
        });
        position = null;
        continue;
      }
    }

    if (!position && prevFast <= prevSlow && currFast > currSlow && rsi < rsiLevel) {
      position = { entry: price, time: candles[i].time };
      trades.push({
        type: 'BUY', price: price,
        time: candles[i].time,
        date: new Date(candles[i].time).toLocaleDateString('en-IN'),
        sl: price * (1 - slPercent / 100),
        tp: price * (1 + tpPercent / 100)
      });
    }

    if (position && prevFast >= prevSlow && currFast < currSlow) {
      const pl = ((price - position.entry) / position.entry * 100);
      trades.push({
        type: 'SELL', price: price,
        time: candles[i].time,
        date: new Date(candles[i].time).toLocaleDateString('en-IN'),
        pl: parseFloat(pl.toFixed(2)), exitReason: 'SIGNAL'
      });
      position = null;
    }
  }

  return trades;
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

function calculatePLWithSLTP(trades) {
  const sells = trades.filter(t => t.type === 'SELL' && t.pl!== undefined);
  if (sells.length === 0) return { totalTrades: 0, winRate: 0, totalPL: 0, bestTrade: 0, slHits: 0, tpHits: 0 };

  const wins = sells.filter(t => t.pl > 0).length;
  const totalPL = sells.reduce((sum, t) => sum + t.pl, 0);
  const bestTrade = Math.max(...sells.map(t => t.pl));
  const slHits = sells.filter(t => t.exitReason === 'SL').length;
  const tpHits = sells.filter(t => t.exitReason === 'TP').length;

  return {
    totalTrades: sells.length,
    winRate: Math.round(wins / sells.length * 100),
    totalPL: totalPL.toFixed(2),
    bestTrade: bestTrade.toFixed(2),
    slHits, tpHits
  };
}
