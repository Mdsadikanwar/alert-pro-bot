export default async function handler(req, res) {
  try {
    // 1. Binance se BTC ka 1h data laao - 50 candles
    const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=50');
    const data = await response.json();
    const closes = data.map(candle => parseFloat(candle[4]));
    
    // 2. EMA 5 aur EMA 20 nikalo
    const ema5 = calculateEMA(closes, 5);
    const ema20 = calculateEMA(closes, 20);
    
    // 3. Current aur Previous values
    const currentEma5 = ema5[ema5.length - 1];
    const prevEma5 = ema5[ema5.length - 2];
    const currentEma20 = ema20[ema20.length - 1];
    const prevEma20 = ema20[ema20.length - 2];
    const price = closes[closes.length - 1];
    
    let signal = 'No crossover';
    
    // 4. BUY: EMA5 ne EMA20 ko neeche se kaata
    if (prevEma5 < prevEma20 && currentEma5 > currentEma20) {
      signal = `🚀 BTC BUY Signal\nEMA 5: ${currentEma5.toFixed(2)} crossed ABOVE EMA 20: ${currentEma20.toFixed(2)}\nPrice: $${price.toFixed(2)}`;
    }
    // 5. SELL: EMA5 ne EMA20 ko upar se kaata 
    else if (prevEma5 > prevEma20 && currentEma5 < currentEma20) {
      signal = `🔻 BTC SELL Signal\nEMA 5: ${currentEma5.toFixed(2)} crossed BELOW EMA 20: ${currentEma20.toFixed(2)}\nPrice: $${price.toFixed(2)}`;
    }
    
    // 6. Signal mila toh Telegram bhejo
    if (signal!== 'No crossover') {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: signal
        })
      });
    }
    
    res.status(200).json({ success: true, signal, price });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}
