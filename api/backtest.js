export default async function handler(req, res) {
  try {
    const { market, startDate, endDate } = req.query;
    const strategy = JSON.parse(req.query.strategy || '{}');

    if (!strategy.coin &&!strategy.stock) {
      return res.status(400).json({ success: false, error: 'Strategy data missing' });
    }

    // STOCK MARKET LOGIC
    if (market === 'stock' || strategy.stock) {
      const stock = strategy.stock || strategy.coin;
      const mockCandles = generateMockStockData(startDate, endDate, stock);
      const signals = runStrategyMTF(mockCandles, strategy);
      const results = calculatePLWithSLTP(signals);

      return res.status(200).json({
        success: true,
        signals: results.totalTrades,
        winRate: results.winRate,
        totalPL: results.totalPL,
        bestTrade: results.bestTrade,
        slHits: results.slHits,
        tpHits: results.tpHits,
        trades: signals,
        message: 'Stock backtest - Mock data. Real API baad mein'
      });
    }

    // CRYPTO LOGIC
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

function generateMockStockData(startDate, endDate, stock) {
  const candles = [];
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  
  const basePrice = { NIFTY: 25000, BANKNIFTY: 52000, RELIANCE: 2800, TCS: 4100, INFY: 1800, HDFCBANK: 1700, ICICIBANK: 1200, SBIN: 800 }[stock] || 1000;
  let price = basePrice;
  
  for (let i = 0; i < days; i++) {
    price += (Math.random() - 0.48) * basePrice * 0.01;
    candles.push({
      time: start + i * 24 * 60 * 60 * 1000,
      close: price,
      open: price,
      high: price * 1.01,
      low: price * 0.99
    });
  }
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
