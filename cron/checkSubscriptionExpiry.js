const { checkSubscriptionExpiry } = require('../services/subscriptionService');

async function runCheckSubscriptionExpiry() {
  try {
    console.log('[Cron] Checking subscription expiry...');
    const count = await checkSubscriptionExpiry();
    console.log(`[Cron] Expired ${count} subscriptions`);
  } catch (err) {
    console.error('[Cron] Subscription expiry check failed:', err.message);
  }
}

module.exports = { runCheckSubscriptionExpiry };
