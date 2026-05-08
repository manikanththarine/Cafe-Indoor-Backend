const { KitchenPrepList, Order } = require('../models');
const { getISTDateString, getISTTimeString } = require('./timeService');
const { serializeDoc } = require('../utils/mongo');

async function generateKitchenListForDate(dateStr, mealType, isManual = false) {
  const orders = await Order.find({
    delivery_date: dateStr,
    meal_type: mealType,
    status: { $ne: 'cancelled' },
  })
    .populate('customer_id', 'name phone address_line1 address_line2 area landmark pincode meal_preference special_instructions')
    .populate('partner_id', 'name')
    .sort({ created_at: 1 });

  const summary = { veg: 0, jain: 0, special: 0, total: orders.length };
  const byArea = {};
  const orderList = [];

  orders.forEach((order, idx) => {
    const customer = order.customer_id || {};
    const pref = customer.meal_preference || 'veg';

    if (pref === 'veg') summary.veg++;
    else if (pref === 'nonveg') summary.nonveg++;
    else if (pref === 'jain') summary.jain++;
    else summary.special++;

    const area = customer.area || 'Other';
    if (!byArea[area]) byArea[area] = { veg: 0, nonveg: 0, jain: 0, special: 0, total: 0 };
    byArea[area][pref === 'nonveg' ? 'nonveg' : pref === 'jain' ? 'jain' : pref === 'special' ? 'special' : 'veg']++;
    byArea[area].total++;

    orderList.push({
      sr: idx + 1,
      orderId: order.id,
      customerName: customer.name || '',
      phone: customer.phone || '',
      address: [customer.address_line1, customer.address_line2, customer.landmark].filter(Boolean).join(', '),
      area,
      pincode: customer.pincode || '',
      mealPreference: pref,
      notes: order.special_note || customer.special_instructions || '',
      partnerName: order.partner_id?.name || '',
      partnerId: order.partner_id?.id || null,
      status: order.status,
    });
  });

  const mealData = { summary, byArea, orders: orderList };

  await KitchenPrepList.findOneAndUpdate(
    { prep_date: dateStr, meal_type: mealType },
    {
      $set: {
        total_count: summary.total,
        veg_count: summary.veg,
        nonveg_count: summary.nonveg,
        jain_count: summary.jain,
        special_count: summary.special,
        meal_data: mealData,
        generated_at: new Date(),
        is_manual_refresh: !!isManual,
      },
    },
    { upsert: true, new: true }
  );

  console.log(`[Kitchen] Generated ${mealType} list for ${dateStr}: ${summary.total} tiffins`);
  return { summary, byArea, orders: orderList, generatedAt: getISTTimeString() };
}

async function getKitchenList(dateStr, mealType) {
  const row = await KitchenPrepList.findOne({ prep_date: dateStr, meal_type: mealType });
  if (!row) return null;

  const serialized = serializeDoc(row);
  serialized.meal_data = serialized.meal_data || {};
  return serialized;
}

async function getTodayKitchenSummary() {
  const today = getISTDateString();
  const [lunch, dinner] = await Promise.all([
    getKitchenList(today, 'lunch'),
    getKitchenList(today, 'dinner'),
  ]);

  return { lunch, dinner, date: today };
}

module.exports = { generateKitchenListForDate, getKitchenList, getTodayKitchenSummary };
