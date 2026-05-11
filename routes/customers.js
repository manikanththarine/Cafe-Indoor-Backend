const express = require('express');
const { body, validationResult } = require('express-validator');
const { Customer, Order, Subscription, SupportTicket } = require('../models');
const { verifyToken } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { escapeRegex, serializeDoc } = require('../utils/mongo');

const router = express.Router();
router.get('/allusers', asyncHandler(async (req, res) => {
  const customer = await Customer.find();
  console.log(customer)
  if (!customer) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ customer: serializeDoc(customer) });
}));

router.get('/profile', verifyToken('customer'), asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.user.id);
  if (!customer) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ customer: serializeDoc(customer) });
}));

router.put('/profile', verifyToken('customer'),
  body('name').optional().notEmpty(),
  body('area').optional(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION_ERROR' });

    const fields = ['name', 'address_line1', 'address_line2', 'area', 'landmark', 'pincode', 'meal_preference', 'special_instructions'];
    const update = {};

    for (const field of fields) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    if (!Object.keys(update).length) return res.status(400).json({ error: 'NO_FIELDS' });

    const customer = await Customer.findByIdAndUpdate(req.user.id, { $set: update }, { new: true });
    res.json({ success: true, customer: serializeDoc(customer) });
  })
);

router.get('/', asyncHandler(async (req, res) => {
  const { search, area, plan_type, page = 1, limit = 50 } = req.query;
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;
  const filters = {};

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filters.$or = [{ name: regex }, { phone: regex }];
  }

  if (area) filters.area = area;

  const [customers, total] = await Promise.all([
    Customer.find(filters).sort({ created_at: -1 }).skip(skip).limit(limitNumber),
    Customer.countDocuments(filters),
  ]);

  const customerIds = customers.map((customer) => customer._id);
  const latestSubscriptions = await Subscription.aggregate([
    { $match: { customer_id: { $in: customerIds } } },
    { $sort: { created_at: -1 } },
    {
      $group: {
        _id: '$customer_id',
        sub_status: { $first: '$status' },
        plan_type: { $first: '$plan_type' },
        sub_end_date: { $first: '$end_date' },
      },
    },
  ]);

  const subMap = new Map(latestSubscriptions.map((item) => [String(item._id), item]));
  let serializedCustomers = customers.map((customer) => {
    const item = serializeDoc(customer);
    const latest = subMap.get(item.id);
    item.sub_status = latest?.sub_status || null;
    item.plan_type = latest?.plan_type || null;
    item.sub_end_date = latest?.sub_end_date || null;
    return item;
  });

  if (plan_type) {
    serializedCustomers = serializedCustomers.filter((customer) => customer.plan_type === plan_type);
  }

  res.json({ customers: serializedCustomers, total: plan_type ? serializedCustomers.length : total });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const [customer, subscriptions, orders, tickets] = await Promise.all([
    Customer.findById(req.params.id),
    Subscription.find({ customer_id: req.params.id }).sort({ created_at: -1 }),
    Order.find({ customer_id: req.params.id }).sort({ delivery_date: -1 }).limit(30),
    SupportTicket.find({ customer_id: req.params.id }).sort({ created_at: -1 }),
  ]);

  if (!customer) return res.status(404).json({ error: 'NOT_FOUND' });

  res.json({
    customer: serializeDoc(customer),
    subscriptions: serializeDoc(subscriptions),
    orders: serializeDoc(orders),
    tickets: serializeDoc(tickets),
  });
}));

module.exports = router;
