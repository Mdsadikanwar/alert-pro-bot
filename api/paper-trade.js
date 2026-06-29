export default async function handler(req, res) {
  try {
    const { market, symbol, strategy, balance, position } = req.query;
    const strat = JSON.parse(strategy);
    const pos = position!== 'null'? JSON.parse(position) : null;
    let currentBalance = parseFloat(balance);

    // 1. LIVE PRICE FETCH
    let currentPrice;
    if (market === 'crypto') {
      const coinId = symbol.toLowerCase().replace('usdt', '');
      const coinMap = { btc: 'bitcoin', eth: 'ethereum' };
      const geckoId = coinMap[coinId] || 'bitcoin';
      const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd`);
      const priceData = await priceRes.json();
      currentPrice = priceData[geckoId].usd;
    } else {
      const alphaRes = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}.BSE&apikey=DRQ4Q13ARJZ6FVEW`);
      const alphaData = await alphaRes.json();
      currentPrice = parseFloat(alphaData['Global Quote']['05. price']);
    }

    if (!currentPrice) throw new Error('Price fetch failed');

    // 2. AGAR POSITION HAI TO SL/TP CHECK KAR
    if (pos) {
      const slPrice = pos.entry * (1 - parseFloat(strat.stopLoss) / 100);
      const tpPrice = pos.entry * (1 + parseFloat(strat.takeProfit) / 100);

      if (currentPrice <= slPrice) {
        const pl = (slPrice - pos.entry) * pos.qty;
        currentBalance += pos.qty * slPrice;
        return res.status(200).json({
          action: 'SELL',
          currentPrice,
          newBalance: currentBalance,
          trade: { type: 'SELL', price: slPrice, qty: pos.qty, pl: parseFloat(pl.toFixed(2)), reason: 'SL HIT' }
        });
      }

      if (currentPrice >= tpPrice) {
        const pl = (tpPrice - pos.entry) * pos.qty;
        currentBalance += pos.qty * tpPrice;
        return res.status(200).json({
          action: 'SELL',
          currentPrice,
          newBalance: currentBalance,
          trade: { type: 'SELL', price: tpPrice, qty: pos.qty, pl: parseFloat(pl.toFixed(2)), reason: 'TP HIT' }
        });
      }

      return res.status(200).json({ action: 'HOLD', currentPrice, position: pos });
    }

    // 3. NAYA SIGNAL CHECK KAR - Simple EMA Crossover
    const riskPercent = parseFloat(strat.risk || 2);
    const riskAmount = currentBalance * (riskPercent / 100);
    const slPercent = parseFloat(strat.stopLoss || 2);
    const qty = riskAmount / (currentPrice * slPercent / 100);

    // Demo: Random signal 20% chance - Real mein strategy logic daal
    if (Math.random() < 0.2) {
      const cost = qty * currentPrice;
      if (cost > currentBalance) throw new Error('Insufficient balance');

      currentBalance -= cost;
      const newPos = { entry: currentPrice, qty: parseFloat(qty.toFixed(4)), time: Date.now() };

      return res.status(200).json({
        action: 'BUY',
        currentPrice,
        newBalance: currentBalance,
        position: newPos,
        trade: { type: 'BUY', price: currentPrice, qty: newPos.qty }
      });
    }

    return res.status(200).json({ action: 'HOLD', currentPrice });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
