const { Order, Subscription } = require('../models');
const { getISTDateString, getTomorrowISTDateString } = require('./timeService');

async function generateDailyOrders() {
  const tomorrow = getTomorrowISTDateString();
  const activeSubscriptions = await Subscription.find({
    status: 'active',
    start_date: { $lte: tomorrow },
    end_date: { $gte: tomorrow },
  });

  let created = 0;

  for (const sub of activeSubscriptions) {
    if (sub.pause_start && sub.pause_end && tomorrow >= sub.pause_start && tomorrow <= sub.pause_end) {
      continue;
    }

    const mealsToCreate = sub.meal_type === 'both' ? ['lunch', 'dinner'] : [sub.meal_type];

    for (const mealType of mealsToCreate) {
      const mealStartDate = sub.meal_start_dates?.[mealType] || sub.start_date;
      if (mealStartDate && tomorrow < mealStartDate) {
        continue;
      }

      const exists = await Order.findOne({
        customer_id: sub.customer_id,
        meal_type: mealType,
        delivery_date: tomorrow,
      });

      if (!exists) {
        await Order.create({
          subscription_id: sub._id,
          customer_id: sub.customer_id,
          meal_type: mealType,
          delivery_date: tomorrow,
          status: 'Pending',
        });
        created++;
      }
    }
  }

  console.log(`[Cron] Generated ${created} orders for ${tomorrow}`);
  return created;
}

async function checkSubscriptionExpiry() {
  const today = getISTDateString();
  const result = await Subscription.updateMany(
    { status: 'active', end_date: { $lt: today } },
    { $set: { status: 'expired' } }
  );

  const count = result.modifiedCount || 0;
  console.log(`[Cron] Marked ${count} subscriptions as expired`);
  return count;
}

module.exports = { generateDailyOrders, checkSubscriptionExpiry };
