export default async function handler(req, res) {
  try {
    const { market, startDate, endDate } = req.query;
    const strategy = JSON.parse(req.query.strategy || '{}');

    if (!strategy.coin &&!strategy.stock) {
      return res.status(400).json({ success: false, error: 'Strategy data missing' });
    }

    // STOCK MARKET - ALPHA VANTAGE
    if (market === 'stock' || strategy.stock) {
      const stock = strategy.stock || strategy.coin;
      const candles = await fetchAlphaVantage(stock, startDate, endDate);
      const signals = runStrategyMTF(candles, strategy);
      const results = calculatePLWithSLTP(signals);

      return res.status(200).json({
        success: true,
        signals: results.totalTrades,
        winRate: results.winRate,
        totalPL: results.totalPL,
        bestTrade: results.bestTrade,
        slHits: results.slHits,
        tpHits: results.tpHits,
        trades: signals
      });
    }

    // CRYPTO - COINGECKO
    const coinId = strategy.coin.toLowerCase().replace('usdt', '');
    const coinMap = { btc: 'bitcoin', eth: 'ethereum', bnb: 'binancecoin', sol: 'solana' };
    const geckoId = coinMap[coinId] || 'bitcoin';

    const fromTime = Math.floor(new Date(startDate).getTime() / 1000);
    const toTime = Math.floor(new Date(endDate).getTime() / 1000);

    const url = `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart/range?vs_currency=usd&from=${fromTime}&to=${toTime}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.prices || data.prices.length === 0) {
      return res.status(200).json({ success: true, signals: 0, winRate: 0, totalPL: 0, bestTrade: 0, trades: [] });
    }

    const candles = data.prices.map(p => ({ time: p[0], close: p[1], open: p[1], high: p[1], low: p[1] }));
    const signals = runStrategyMTF(candles, strategy);
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

// ALPHA VANTAGE - TERI KEY KE SAATH
async function fetchAlphaVantage(stock, startDate, endDate) {
  const API_KEY = 'DRQ4Q13ARJZ6FVEW';

  const symbolMap = {
    'NIFTY': '^NSEI',
    'BANKNIFTY': '^NSEBANK',
    'RELIANCE': 'RELIANCE.BSE',
    'TCS': 'TCS.BSE',
    'INFY': 'INFY.BSE',
    'HDFCBANK': 'HDFCBANK.BSE',
    'ICICIBANK': 'ICICIBANK.BSE',
    'SBIN': 'SBIN.BSE'
  };

  const symbol = symbolMap[stock] || `${stock}.BSE`;
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data['Error Message'] || data['Note']) {
    throw new Error(data['Error Message'] || 'API limit hit. 1 min wait kar');
  }

  if (!data['Time Series (Daily)']) {
    throw new Error('Stock data nahi mila. Symbol check kar: ' + symbol);
  }

  const timeSeries = data['Time Series (Daily)'];
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();

  const candles = Object.entries(timeSeries)
   .map(([date, values]) => ({
      time: new Date(date).getTime(),
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close'])
    }))
   .filter(c => c.time >= startTime && c.time <= endTime)
   .sort((a, b) => a.time - b.time);

  return candles;
}

function runStrategyMTF(candles, strat) {
  const emaFast = parseInt(strat.emaFast);
  const emaSlow = parseInt(strat.emaSlow);
  const rsiPeriod = parseInt(strat.rsiPeriod);
  const rsiLevel = parseInt(strat.rsiLevel);
  const slPercent = parseFloat(strat.stopLoss || 2);
  const tpPercent = parseFloat(strat.takeProfit || 4);
  const tfSignal = strat.timeframeSignal || '1h';
  const tfEntry = strat.timeframeEntry || '15m';

  if (candles.length < emaSlow + 5) return [];

  const closes = candles.map(c => c.close);
  const emaFastArr = calcEMA(closes, emaFast);
  const emaSlowArr = calcEMA(closes, emaSlow);
  const rsiArr = calcRSI(closes, rsiPeriod);

  let trades = [];
  let position = null;
  let signalReady = false;

  for (let i = emaSlow; i < candles.length; i++) {
    if (!emaFastArr[i-1] ||!emaSlowArr[i-1] ||!rsiArr[i]) continue;

    const price = candles[i].close;
    const prevFast = emaFastArr[i-1];
    const prevSlow = emaSlowArr[i-1];
    const currFast = emaFastArr[i];
    const currSlow = emaSlowArr[i];
    const rsi = rsiArr[i];

    if (!signalReady && prevFast <= prevSlow && currFast > currSlow && rsi < rsiLevel) {
      signalReady = true;
    }

    if (position) {
      const slPrice = position.entry * (1 - slPercent / 100);
      const tpPrice = position.entry * (1 + tpPercent / 100);

      if (price <= slPrice) {
        trades.push({ type: 'SELL', price: slPrice, time: candles[i].time, date: new Date(candles[i].time).toLocaleDateString('en-IN'), pl: -slPercent, exitReason: 'SL' });
        position = null; signalReady = false; continue;
      }

      if (price >= tpPrice) {
        trades.push({ type: 'SELL', price: tpPrice, time: candles[i].time, date: new Date(candles[i].time).toLocaleDateString('en-IN'), pl: tpPercent, exitReason: 'TP' });
        position = null; signalReady = false; continue;
      }
    }

    if (!position && signalReady && currFast > currSlow) {
      position = { entry: price, time: candles[i].time };
      trades.push({ type: 'BUY', price: price, time: candles[i].time, date: new Date(candles[i].time).toLocaleDateString('en-IN'), sl: price * (1 - slPercent / 100), tp: price * (1 + tpPercent / 100), tf: `${tfSignal}/${tfEntry}` });
      signalReady = false;
    }

    if (position && prevFast >= prevSlow && currFast < currSlow) {
      const pl = ((price - position.entry) / position.entry * 100);
      trades.push({ type: 'SELL', price: price, time: candles[i].time, date: new Date(candles[i].time).toLocaleDateString('en-IN'), pl: parseFloat(pl.toFixed(2)), exitReason: 'SIGNAL' });
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
  let totalPL = 0;
  let wins = 0;
  let slHits = 0;
  let tpHits = 0;
  let bestTrade = 0;

  for (let i = 0; i < trades.length; i++) {
    if (trades[i].type === 'SELL' && trades[i].pl!== undefined) {
      const pl = trades[i].pl;
      totalPL += pl;
      if (pl > 0) wins++;
      if (pl > bestTrade) bestTrade = pl;
      if (trades[i].exitReason === 'SL') slHits++;
      if (trades[i].exitReason === 'TP') tpHits++;
    }
  }

  const sellTrades = trades.filter(t => t.type === 'SELL' && t.pl!== undefined);
  const totalTrades = sellTrades.length;
  const winRate = totalTrades > 0? (wins / totalTrades * 100) : 0;

  return {
    totalTrades,
    winRate: parseFloat(winRate.toFixed(1)),
    totalPL: parseFloat(totalPL.toFixed(2)),
    bestTrade: parseFloat(bestTrade.toFixed(2)),
    slHits,
    tpHits
  };
}
