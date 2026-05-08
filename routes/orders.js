const express = require('express');
const { getISTDateString } = require('../services/timeService');
const { verifyToken } = require('../middleware/auth');
const { Customer, DeliveryPartner, Order } = require('../models');
const { asyncHandler } = require('../utils/asyncHandler');
const { serializeDoc } = require('../utils/mongo');

const router = express.Router();

router.get('/today', verifyToken('customer'), asyncHandler(async (req, res) => {
  const today = getISTDateString();
  const orders = await Order.find({ customer_id: req.user.id, delivery_date: today })
    .populate('partner_id', 'name phone')
    .sort({ meal_type: 1 });

  const serializedOrders = orders.map((order) => {
    const item = serializeDoc(order);
    item.partner_name = order.partner_id?.name || null;
    item.partner_phone = order.partner_id?.phone || null;
    return item;
  });

  res.json({ orders: serializedOrders, date: today });
}));

router.get('/history', verifyToken('customer'), asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find({ customer_id: req.user.id })
      .populate('partner_id', 'name')
      .sort({ delivery_date: -1, meal_type: 1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments({ customer_id: req.user.id }),
  ]);

  const serializedOrders = orders.map((order) => {
    const item = serializeDoc(order);
    item.partner_name = order.partner_id?.name || null;
    return item;
  });

  res.json({ orders: serializedOrders, total, page });
}));

router.get('/:id', verifyToken('customer'), asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customer_id: req.user.id })
    .populate('partner_id', 'name phone');

  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });

  const serializedOrder = serializeDoc(order);
  serializedOrder.partner_name = order.partner_id?.name || null;
  serializedOrder.partner_phone = order.partner_id?.phone || null;

  res.json({ order: serializedOrder });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { date, status, partnerId, area, page = 1, limit = 50 } = req.query;
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const filters = {};
  if (date) filters.delivery_date = date;
  if (status) filters.status = status;
  if (partnerId) filters.partner_id = partnerId;

  if (area) {
    const customersInArea = await Customer.find({ area }, '_id');
    filters.customer_id = { $in: customersInArea.map((customer) => customer._id) };
  }

  const [orders, total] = await Promise.all([
    Order.find(filters)
      .populate('customer_id', 'name phone area address_line1 meal_preference')
      .populate('partner_id', 'name')
      .sort({ delivery_date: -1, created_at: -1 })
      .skip(skip)
      .limit(limitNumber),
    Order.countDocuments(filters),
  ]);

  const serializedOrders = orders.map((order) => {
    const item = serializeDoc(order);
    item.customer_name = order.customer_id?.name || null;
    item.phone = order.customer_id?.phone || null;
    item.area = order.customer_id?.area || null;
    item.address_line1 = order.customer_id?.address_line1 || null;
    item.meal_preference = order.customer_id?.meal_preference || null;
    item.partner_name = order.partner_id?.name || null;
    return item;
  });

  res.json({ orders: serializedOrders, total });
}));

router.put('/:id/status', asyncHandler(async (req, res) => {
  const { status, partnerId } = req.body;
  const validStatuses = ['Pending', 'Confirmed', 'Picked_up', 'In_transit', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'INVALID_STATUS' });

  const update = { status };
  const timestampField = {
    Confirmed: 'status_confirmed_at',
    Picked_up: 'status_picked_up_at',
    In_transit: 'status_in_transit_at',
    Delivered: 'status_delivered_at',
  }[status];

  if (timestampField) update[timestampField] = new Date();
  if (partnerId) update.partner_id = partnerId;

  await Order.updateOne({ _id: req.params.id }, { $set: update });
  res.json({ success: true });
}));

router.put('/:id/reassign', asyncHandler(async (req, res) => {
  const { partnerId } = req.body;
  await Order.updateOne({ _id: req.params.id }, { $set: { partner_id: partnerId || null } });
  res.json({ success: true });
}));

module.exports = router;
