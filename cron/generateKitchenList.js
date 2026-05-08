const { getISTDateString } = require('../services/timeService');
const { generateKitchenListForDate } = require('../services/kitchenService');

async function generateKitchenList(mealType) {
  try {
    const today = getISTDateString();
    console.log(`[Cron] Generating kitchen list: ${mealType} for ${today}`);
    const result = await generateKitchenListForDate(today, mealType, false);
    console.log(`[Cron] Kitchen list generated: ${mealType} - ${result.summary.total} tiffins`);
  } catch (err) {
    console.error(`[Cron] Kitchen list generation failed for ${mealType}:`, err.message);
  }
}

module.exports = { generateKitchenList };
