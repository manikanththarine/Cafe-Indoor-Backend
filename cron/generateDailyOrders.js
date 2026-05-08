const { generateDailyOrders } = require('../services/subscriptionService');

async function runGenerateDailyOrders() {
  try {
    console.log('[Cron] Generating daily orders...');
    const count = await generateDailyOrders();
    console.log(`[Cron] Daily orders generated: ${count}`);
  } catch (err) {
    console.error('[Cron] Daily order generation failed:', err.message);
  }
}

module.exports = { runGenerateDailyOrders };
