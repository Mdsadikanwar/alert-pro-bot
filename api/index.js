export default async function handler(req, res) {
  // CORS enable करो
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { query } = req;
  
  // 1. BTC Price API
  if (req.url.includes('/api?coins=')) {
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd');
      const data = await r.json();
      return res.status(200).json({ 
        ok: true,
        btc_price: `$${data.bitcoin.usd.toLocaleString()}`,
        eth_price: `$${data.ethereum.usd.toLocaleString()}`,
        sol_price: `$${data.solana.usd.toLocaleString()}`,
        alert_sent: false
      });
    } catch(e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }
  
  // 2. Stocks API - Yahoo Finance proxy
  if (req.url.includes('/api/stocks')) {
    try {
      const r = await fetch('https://query1.finance.yahoo.com/v7/finance/quote?symbols=^NSEI,RELIANCE.NS,TCS.NS');
      const data = await r.json();
      return res.status(200).json({ ok: true, stocks: data.quoteResponse.result });
    } catch(e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }
  
  // Default - BTC price
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await r.json();
    return res.status(200).json({ 
      ok: true, 
      btc_price: `$${data.bitcoin.usd.toLocaleString()}`, 
      alert_sent: false 
    });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
