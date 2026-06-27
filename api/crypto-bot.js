export default async function handler(req, res) {
  const alerts = [];
  const cryptoList = [
    { id: 'bitcoin', sym: 'BTC', s: 5, l: 20 },
    { id: 'ethereum', sym: 'ETH', s: 9, l: 21 },
    { id: 'solana', sym: 'SOL', s: 5, l: 20 },
    { id: 'binancecoin', sym: 'BNB', s: 12, l: 26 },
    { id: 'ripple', sym: 'XRP', s: 5, l: 20 }
    // Naye coin yahan add kar dena bhai
  ];

  for (const c of cryptoList) {
    const sig = await checkCrypto(c.id, c.sym, c.s, c.l);
    if (sig!== 'No crossover') alerts.push(sig);
  }

  if (alerts.length > 0) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `🚀 *CRYPTO ALERT* 🚀\n\n${alerts.join('\n\n')}`,
        parse_mode: 'Markdown'
      })
    });
  }
  res.status(200).json({ success: true, alerts: alerts.length });
}

async function checkCrypto(id, sym, s, l) {
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=2&interval=hourly`);
    const d = await r.json();
    const closes = d.prices.map(p => p[1]);
    const emaS = calcEMA(closes, s), emaL = calcEMA(closes, l);
    const cS = emaS.at(-1), pS = emaS.at(-2), cL = emaL.at(-1), pL = emaL.at(-2);
    const price = closes.at(-1);
    if (pS < pL && cS > cL) return `*${sym} BUY*\nEMA${s}: ${cS.toFixed(2)} > EMA${l}: ${cL.toFixed(2)}\nPrice: $${price.toFixed(2)}`;
    if (pS > pL && cS < cL) return `*${sym} SELL*\nEMA${s}: ${cS.toFixed(2)} < EMA${l}: ${cL.toFixed(2)}\nPrice: $${price.toFixed(2)}`;
    return 'No crossover';
  } catch { return 'No crossover'; }
}

function calcEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  return ema;
}
