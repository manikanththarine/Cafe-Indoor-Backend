const express = require('express');
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const { Customer, Subscription } = require('../models');
const { asyncHandler } = require('../utils/asyncHandler');
const { serializeDoc } = require('../utils/mongo');

const router = express.Router();

router.get('/', verifyToken('customer'), asyncHandler(async (req, res) => {
  const sub = await Subscription.findOne({
    customer_id: req.user.id,
    status: { $in: ['active', 'paused'] },
  }).sort({ created_at: -1 });

  res.json({ subscription: sub ? serializeDoc(sub) : null });
}));

router.post('/pause', verifyToken('customer'),
  body('startDate').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('endDate').matches(/^\d{4}-\d{2}-\d{2}$/),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION_ERROR' });

    const sub = await Subscription.findOne({ customer_id: req.user.id, status: 'active' }).sort({ created_at: -1 });
    if (!sub) return res.status(400).json({ error: 'NO_ACTIVE_SUB', message: 'No active subscription found.' });

    const { startDate, endDate } = req.body;
    sub.status = 'paused';
    sub.pause_start = startDate;
    sub.pause_end = endDate;
    await sub.save();

    res.json({ success: true, message: `Subscription will be paused from ${startDate} to ${endDate}.` });
  })
);

router.post('/cancel', verifyToken('customer'), asyncHandler(async (req, res) => {
  const sub = await Subscription.findOne({
    customer_id: req.user.id,
    status: { $in: ['active', 'paused'] },
  }).sort({ created_at: -1 });

  if (!sub) return res.status(400).json({ error: 'NO_SUB' });

  sub.status = 'cancelled';
  await sub.save();

  res.json({ success: true, message: 'Subscription has been cancelled.' });
}));

router.get('/all', verifyToken('admin'), asyncHandler(async (req, res) => {
  const { status, plan_type, page = 1, limit = 50 } = req.query;
  const filters = {};
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  if (status) filters.status = status;
  if (plan_type) filters.plan_type = plan_type;

  const [subscriptions, total] = await Promise.all([
    Subscription.find(filters)
      .populate('customer_id', 'name phone area')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNumber),
    Subscription.countDocuments(filters),
  ]);

  const serializedSubscriptions = subscriptions.map((subscription) => {
    const item = serializeDoc(subscription);
    item.customer_name = subscription.customer_id?.name || null;
    item.phone = subscription.customer_id?.phone || null;
    item.area = subscription.customer_id?.area || null;
    return item;
  });

  res.json({ subscriptions: serializedSubscriptions, total });
}));


module.exports = router;
