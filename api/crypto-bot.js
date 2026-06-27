const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function getData(symbol, interval, limit) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  return await res.json();
}

function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(closes, period = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateVWAP(data) {
  let cumPV = 0, cumVol = 0;
  for (let k of data) {
    const typicalPrice = (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3;
    const volume = parseFloat(k[5]);
    cumPV += typicalPrice * volume;
    cumVol += volume;
  }
  return cumPV / cumVol;
}

async function checkSignal(symbol) {
  // 1-min data for entry
  const data1m = await getData(symbol, '1m', 50);
  const closes1m = data1m.map(k => parseFloat(k[4]));
  const volumes1m = data1m.map(k => parseFloat(k[5]));
  
  // 5-min data for trend confirmation
  const data5m = await getData(symbol, '5m', 30);
  const closes5m = data5m.map(k => parseFloat(k[4]));
  
  const ema5_1m = calculateEMA(closes1m, 5);
  const ema20_1m = calculateEMA(closes1m, 20);
  const ema5_5m = calculateEMA(closes5m, 5);
  const ema20_5m = calculateEMA(closes5m, 20);
  
  const rsi = calculateRSI(closes1m, 14);
  const vwap = calculateVWAP(data1m);
  const currentPrice = closes1m[closes1m.length - 1];
  const avgVol = volumes1m.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
  const currentVol = volumes1m[volumes1m.length - 1];
  
  // All 5 conditions
  const buyCondition = 
    ema5_1m > ema20_1m && // 1. EMA Cross UP
    ema5_5m > ema20_5m && // 2. 5-min trend UP  
    currentPrice > vwap && // 3. Above VWAP
    rsi > 30 && rsi < 70 && // 4. RSI not extreme
    currentVol > avgVol * 1.5; // 5. Volume spike
    
  const sellCondition = 
    ema5_1m < ema20_1m && // 1. EMA Cross DOWN
    ema5_5m < ema20_5m && // 2. 5-min trend DOWN
    currentPrice < vwap && // 3. Below VWAP  
    rsi > 30 && rsi < 70 && // 4. RSI not extreme
    currentVol > avgVol * 1.5; // 5. Volume spike

  if (buyCondition) return { signal: 'BUY', price: currentPrice, rsi: rsi.toFixed(1) };
  if (sellCondition) return { signal: 'SELL', price: currentPrice, rsi: rsi.toFixed(1) };
  return { signal: null };
}

export default async function handler(req, res) {
  const coins = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  let alerts = 0;
  
  for (let coin of coins) {
    const result = await checkSignal(coin);
    if (result.signal) {
      alerts++;
      const msg = `🚨 CRYPTO ALERT 🚨\n\nCoin: ${coin}\nSignal: ${result.signal}\nPrice: $${result.price.toFixed(2)}\nRSI: ${result.rsi}\nStrategy: EMA+VWAP+RSI+Vol+MTF\n\nTime: ${new Date().toLocaleTimeString('en-IN')}`;
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg })
      });
    }
  }
  res.status(200).json({ success: true, alerts });
}
