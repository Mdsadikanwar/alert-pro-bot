export default async function handler(req, res) {
  try {
    const { market, startDate, endDate } = req.query;
    const strategy = JSON.parse(req.query.strategy || '{}');

    if (!strategy.coin) {
      return res.status(400).json({ success: false, error: 'Strategy data missing' });
    }

    if (market!== 'crypto') {
      return res.status(200).json({ success: false, error: 'Stock backtest abhi ready nahi.' });
    }

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

  for (let i = emaSlow; i < candles.length
