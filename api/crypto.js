export default async function handler(req, res) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN ||!process.env.TELEGRAM_CHAT_ID) {
      return res.status(500).json({ error: 'Telegram env vars missing' });
    }

    // CoinGecko API - Vercel se 100% chalti hai
    const response = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2&interval=hourly');
    
    if (!response.ok) {
      return res.status(500).json({ error: `CoinGecko API failed: ${response.status}` });
    }
    
    const data = await response.json();
    const closes = data.prices.map(p => p[1]); // CoinGecko format alag hai
    
    if (closes.length < 20) {
      return res.status(500).json({ error: 'Not enough data from CoinGecko' });
    }
    
    const ema5 = calculateEMA(closes, 5);
    const ema20 = calculateEMA(closes, 20);
    
    const currentEma5 = ema5[ema5.length - 1];
    const prevEma5 = ema5[ema5.length - 2];
    const currentEma20 = ema20[ema20.length - 1];
    const prevEma20 = ema20[ema20.length - 2];
    const price = closes[closes.length - 1];
    
    let signal = 'No crossover';
    
    if (prevEma5 < prevEma20 && currentEma5 > currentEma20) {
      signal = `🚀 BTC BUY Signal\nEMA 5: ${currentEma5.toFixed(2)} crossed ABOVE EMA 20: ${currentEma20.toFixed(2)}\nPrice: $${price.toFixed(2)}`;
    }
    else if (prevEma5 > prevEma20 && currentEma5 < currentEma20) {
      signal = `🔻 BTC SELL Signal\nEMA 5: ${currentEma5.toFixed(2)} crossed BELOW EMA 20: ${currentEma20.toFixed(2)}\nPrice: $${price.toFixed(2)}`;
    }
    
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
    
    res.status(200).json({ 
      success: true, 
      signal, 
      price: price.toFixed(2), 
      ema5: currentEma5.toFixed(2), 
      ema20: currentEma20.toFixed(2),
      source: 'CoinGecko'
    });
    
  } catch (error) {
    console.error(error);
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
