const cron = require('node-cron');
const { generateKitchenList } = require('./generateKitchenList');
const { runGenerateDailyOrders } = require('./generateDailyOrders');
const { runCheckSubscriptionExpiry } = require('./checkSubscriptionExpiry');
const { sendCutoffReminder } = require('../services/notificationService');

function initCronJobs() {
  // TZ is set to Asia/Kolkata in server.js, so schedule strings use IST times

  // 8:30 AM IST — 30-min warning before lunch cutoff (9 AM)
  cron.schedule('30 8 * * *', () => sendCutoffReminder('lunch').catch(() => {}), { timezone: 'Asia/Kolkata' });

  // 9:01 AM IST — generate lunch kitchen prep list
  cron.schedule('1 9 * * *', () => generateKitchenList('lunch'), { timezone: 'Asia/Kolkata' });

  // 3:30 PM IST — 30-min warning before dinner cutoff (4 PM)
  cron.schedule('30 15 * * *', () => sendCutoffReminder('dinner').catch(() => {}), { timezone: 'Asia/Kolkata' });

  // 4:01 PM IST — generate dinner kitchen prep list
  cron.schedule('1 16 * * *', () => generateKitchenList('dinner'), { timezone: 'Asia/Kolkata' });

  // Midnight IST — generate orders for next day
  cron.schedule('0 0 * * *', () => runGenerateDailyOrders(), { timezone: 'Asia/Kolkata' });

  // 8:00 AM IST — check subscription expiry
  cron.schedule('0 8 * * *', () => runCheckSubscriptionExpiry(), { timezone: 'Asia/Kolkata' });

  console.log('[Cron] All scheduled jobs registered (IST timezone)');
}

module.exports = { initCronJobs };
