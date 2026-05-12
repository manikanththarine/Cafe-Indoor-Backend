const express = require('express');
const { getISTDateString } = require('../services/timeService');
const { verifyToken } = require('../middleware/auth');
const { DeliveryPartner, Setting, Subscription, SupportTicket, Order } = require('../models');
const { asyncHandler } = require('../utils/asyncHandler');
const { serializeDoc } = require('../utils/mongo');

const router = express.Router();

router.get('/dashboard/stats', verifyToken('admin'), asyncHandler(async (_req, res) => {
  const today = getISTDateString();
  const monthPrefix = today.slice(0, 7);

  const [
    activeSubscribers,
    trialSubscribers,
    todayOrders,
    todayDelivered,
    openTickets,
    partnersOnDuty,
    todayRevenueRows,
    monthRevenueRows,
  ] = await Promise.all([
    Subscription.countDocuments({ status: 'active', plan_type: 'monthly' }),
    Subscription.countDocuments({ status: 'active', plan_type: 'trial' }),
    Order.countDocuments({ delivery_date: today, status: { $ne: 'cancelled' } }),
    Order.countDocuments({ delivery_date: today, status: 'delivered' }),
    SupportTicket.countDocuments({ status: 'open' }),
    DeliveryPartner.countDocuments({ is_on_duty: true }),
    Subscription.aggregate([
      { $match: { created_at: { $gte: new Date(`${today}T00:00:00`), $lt: new Date(`${today}T23:59:59.999`) } } },
      { $group: { _id: null, total: { $sum: '$amount_paid' } } },
    ]),
    Subscription.aggregate([
      {
        $addFields: {
          yearMonth: {
            $dateToString: { format: '%Y-%m', date: '$created_at', timezone: 'Asia/Kolkata' },
          },
        },
      },
      { $match: { yearMonth: monthPrefix } },
      { $group: { _id: null, total: { $sum: '$amount_paid' } } },
    ]),
  ]);

  res.json({
    activeSubscribers,
    trialSubscribers,
    todayOrders,
    todayDelivered,
    revenueToday: todayRevenueRows[0]?.total || 0,
    revenueMonth: monthRevenueRows[0]?.total || 0,
    openTickets,
    partnersOnDuty,
  });
}));

router.get('/revenue/summary', verifyToken('admin'), asyncHandler(async (req, res) => {
  const period = req.query.period || 'week';
  let groupFormat = '%Y-%W';
  let labelField = 'week';
  let rangeStart = new Date();

  if (period === 'day') {
    groupFormat = '%Y-%m-%d';
    labelField = 'date';
    rangeStart.setDate(rangeStart.getDate() - 30);
  } else if (period === 'week') {
    rangeStart.setDate(rangeStart.getDate() - 90);
  } else {
    groupFormat = '%Y-%m';
    labelField = 'month';
    rangeStart = new Date('2000-01-01T00:00:00');
  }

  const [data, transactions] = await Promise.all([
    Subscription.aggregate([
      { $match: { created_at: { $gte: rangeStart } } },
      {
        $group: {
          _id: {
            $dateToString: { format: groupFormat, date: '$created_at', timezone: 'Asia/Kolkata' },
          },
          revenue: { $sum: '$amount_paid' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          [labelField]: '$_id',
          revenue: 1,
          count: 1,
        },
      },
    ]),
    Subscription.find()
      .populate('customer_id', 'name phone')
      .sort({ created_at: -1 })
      .limit(100),
  ]);

  const serializedTransactions = transactions.map((subscription) => {
    const item = serializeDoc(subscription);
    item.customer_name = subscription.customer_id?.name || null;
    item.phone = subscription.customer_id?.phone || null;
    return item;
  });

  res.json({ data, transactions: serializedTransactions });
}));

router.get('/settings',asyncHandler(async (_req, res) => {
  console.log('sdjsdsj')
  const settings = await Setting.find().sort({ key: 1 });
  const obj = {};
  settings.forEach((setting) => { obj[setting.key] = setting.value; });
  res.json({ settings: obj });
}));

router.put('/settings', verifyToken('admin'), asyncHandler(async (req, res) => {
  await Promise.all(Object.entries(req.body).map(([key, value]) => (
    Setting.updateOne({ key }, { $set: { value: String(value) } }, { upsert: true })
  )));
  res.json({ success: true });
}));

router.put(
  '/orders/assign-partner',
  asyncHandler(async (req, res) => {
    const { partnerId, order_id } = req.body;

    console.log(order_id, partnerId);

    // 1. Find Order
    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // 2. Find Partner
    const partner = await DeliveryPartner.findById(partnerId);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'No delivery partner found',
      });
    }

    // 3. Update Order
    order.partner_id = partner._id;
    order.status = 'conformed';
    order.status_confirmed_at =  new Date();

    await order.save();

    // 4. Response
    res.status(200).json({
      success: true,
      message: 'Partner assigned successfully',
      data: {
        orderId: order._id,
        partnerId: partner._id,
        partnerName: partner.name,
      },
    });
  })
);
module.exports = router;
