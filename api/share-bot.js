const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function getShareData(symbol) {
  try {
    // Yahoo Finance API - Free hai, key nahi chahiye
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=5m&range=1d`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Yahoo API Error: ${res.status}`);
    const data = await res.json();
    return data.chart.result[0];
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
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
    const gain = diff > 0? diff : 0;
    const loss = diff < 0? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  const rs = avgLoss === 0? 100 : avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateVWAP(candles) {
  let cumPV = 0, cumVol = 0;
  for (let i = 0; i < candles.timestamp.length; i++) {
    const high = candles.high[i];
    const low = candles.low[i];
    const close = candles.close[i];
    const vol = candles.volume[i];
    const typicalPrice = (high + low + close) / 3;
    cumPV += typicalPrice * vol;
    cumVol += vol;
  }
  return cumPV / cumVol;
}

async function checkShareSignal(symbol) {
  const data = await getShareData(symbol);
  
  if (!data ||!data.timestamp || data.timestamp.length < 30) {
    console.log(`Skipping ${symbol} - No data`);
    return { signal: null };
  }
  
  const candles = data.indicators.quote[0];
  const closes = candles.close.filter(c => c!== null);
  const volumes = candles.volume.filter(v => v!== null);
  const opens = candles.open.filter(o => o!== null);
  
  if (closes.length < 20) return { signal: null };
  
  const ema5 = calculateEMA(closes, 5);
  const ema20 = calculateEMA(closes, 20);
  const rsi = calculateRSI(closes, 14);
  const vwap = calculateVWAP(candles);
  
  const currentPrice = closes[closes.length - 1];
  const openPrice = opens[0]; // Din ka first candle
  const avgVol = volumes.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
  const currentVol = volumes[volumes.length - 1];
  
  // SHARE MARKET KE LIYE SPECIAL: Gap Up/Down + VWAP + RSI + Volume
  const gapUp = ((currentPrice - openPrice) / openPrice) * 100 > 0.5; // 0.5% gap up
  const gapDown = ((currentPrice - openPrice) / openPrice) * 100 < -0.5; // 0.5% gap down
  
  const buyCondition = 
    gapUp && 
    currentPrice > vwap && 
    ema5 > ema20 && 
    rsi > 50 && rsi < 70 && 
    currentVol > avgVol * 1.5;
    
  const sellCondition = 
    gapDown && 
    currentPrice < vwap && 
    ema5 < ema20 && 
    rsi > 30 && rsi < 50 && 
    currentVol > avgVol * 1.5;

  if (buyCondition) return { signal: 'BUY', price: currentPrice, rsi: rsi.toFixed(1), gap: ((currentPrice - openPrice) / openPrice * 100).toFixed(2) };
  if (sellCondition) return { signal: 'SELL', price: currentPrice, rsi: rsi.toFixed(1), gap: ((currentPrice - openPrice) / openPrice * 100).toFixed(2) };
  return { signal: null };
}

export default async function handler(req, res) {
  // NIFTY 50 ke top stocks + Index
  const stocks = ['^NSEI', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];
  let alerts = 0;
  
  for (let stock of stocks) {
    const result = await checkShareSignal(stock);
    if (result.signal) {
      alerts++;
      const msg = `🚨 SHARE ALERT 🚨\n\nStock: ${stock}\nSignal: ${result.signal}\nPrice: ₹${result.price.toFixed(2)}\nGap: ${result.gap}%\nRSI: ${result.rsi}\nStrategy: Gap+VWAP+EMA+RSI+Vol\n\nTime: ${new Date().toLocaleTimeString('en-IN')}`;
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg })
      });
    }
  }
  res.status(200).json({ success: true, alerts });
}
