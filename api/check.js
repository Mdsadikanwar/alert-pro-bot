export default async function handler(req, res) {
  try {
    // Binance से BTC price ले रहे हैं
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    const data = await response.json();
    const price = parseFloat(data.price);

    let message = `💰 BTC Price: $${price}`;

    // Test alert: 65000 से ऊपर गया तो alert
    if (price > 65000) {
      message = `🚨 ALERT: BTC crossed $65000! \nCurrent Price: $${price}`;
    }

    return res.status(200).json({ ok: true, price: price, alert: price > 65000 });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
