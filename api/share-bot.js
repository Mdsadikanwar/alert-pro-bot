export default async function handler(req, res) {
  const alerts = [];
  const IST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  const day = IST.getDay();

  // Sirf Mon-Fri chalega
  if (day >= 1 && day <= 5) {
    const shareList = [
      { sym: 'RELIANCE.NS', name: 'Reliance' },
      { sym: 'TCS.NS', name: 'TCS' },
      { sym: 'HDFCBANK.NS', name: 'HDFC Bank' },
      { sym: 'INFY.NS', name: 'Infosys' }
      // Naye stock yahan add kar dena
    ];

    for (const s of shareList) {
      const sig = await checkShare(s.sym, s.name);
      if (sig!== 'No signal') alerts.push(sig);
    }
  }

  if (alerts.length > 0) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `📈 *SHARE MARKET ALERT* 📈\n\n${alerts.join('\n\n')}`,
        parse_mode: 'Markdown'
      })
    });
  }
  res.status(200).json({ success: true, alerts: alerts.length });
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
      if (gap > 0 && price > vwap) return `*${name} BUY*\nGap Up: ${gap.toFixed(2)}%\nPrice ${price.toFixed(2)} > VWAP ${vwap.toFixed(2)}`;
      if (gap < 0 && price < vwap) return `*${name} SELL*\nGap Down: ${gap.toFixed(2)}%\nPrice ${price.toFixed(2)} < VWAP ${vwap.toFixed(2)}`;
    }
    return 'No signal';
  } catch { return 'No signal'; }
}
