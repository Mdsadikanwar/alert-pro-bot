export default async function handler(req, res) {
  const alerts = [];
  const IST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  const hour = IST.getHours();
  const min = IST.getMinutes();
  const day = IST.getDay();

  // CRYPTO 24x7
  const cryptoList = [
    { id: 'bitcoin', sym: 'BTC', s: 5, l: 20 },
    { id: 'ethereum', sym: 'ETH', s: 9, l: 21 },
    { id: 'solana', sym: 'SOL', s: 5, l: 20 }
  ];

  for (const c of cryptoList) {
    const sig = await checkCrypto(c.id, c.sym, c.s, c.l);
    if (sig!== 'No crossover') alerts.push(sig);
  }

  // SHARE 9:15-3:30 MON-FRI
  if (day >= 1 && day <= 5 && hour >= 9 && hour <= 15) {
    if (hour === 9 && min >= 15 || hour > 9) {
      const shareList = [
        { sym: 'RELIANCE.NS', name: 'Reliance' },
        { sym: 'TCS.NS', name: 'TCS' }
      ];
      for (const s of shareList) {
        const sig = await checkShare(s.sym, s.name);
        if (sig!== 'No crossover') alerts.push(sig);
      }
    }
  }

  // TELEGRAM BHEJO
  if (alerts.length > 0) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `🚨 *MASTER BOT ALERT* 🚨\n\n${alerts.join('\n\n')}`,
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
    if (pS < pL && cS > cL) return `🚀 *${sym} BUY*\nEMA${s}: ${cS.toFixed(2)} > EMA${l}: ${cL.toFixed(2)}\n$${price.toFixed(2)}`;
    if (pS > pL && cS < cL) return `🔻 *${sym} SELL*\nEMA${s}: ${cS.toFixed(2)} < EMA${l}: ${cL.toFixed(2)}\n$${price.toFixed(2)}`;
    return 'No crossover';
  } catch { return 'No crossover'; }
}

async function checkShare(symbol, name) {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=2d`);
    const d = await r.json();
    const q = d.chart.result[0].indicators.quote[0];
    const closes = q.close, opens = q.open, vols = q.volume;
    const yClose = closes[closes.length - 376];
    const tOpen = opens.at(-1), price = closes.at(-1);
    const gap = ((tOpen - yClose) / yClose) * 100;
    const td = closes.slice(-30), tv = vols.slice(-30);
    let vwap = td.reduce((a, p, i) => a + p * tv[i], 0) / tv.reduce((a, v) => a + v, 0);
    if (Math.abs(gap) > 1) {
      if (gap > 0 && price > vwap) return `🚀 *${name} BUY*\nGap: ${gap.toFixed(2)}% | Price ${price.toFixed(2)} > VWAP ${vwap.toFixed(2)}`;
      if (gap < 0 && price < vwap) return `🔻 *${name} SELL*\nGap: ${gap.toFixed(2)}% | Price ${price.toFixed(2)} < VWAP ${vwap.toFixed(2)}`;
    }
    return 'No crossover';
  } catch { return 'No crossover'; }
}

function calcEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  return ema;
}
