const express = require('express');
const { body, validationResult } = require('express-validator');
const { getISTDateString } = require('../services/timeService');
const { verifyToken } = require('../middleware/auth');
const { onOrderStatusChange } = require('../services/notificationService');
const { DeliveryPartner, Order } = require('../models');
const { asyncHandler } = require('../utils/asyncHandler');
const { serializeDoc } = require('../utils/mongo');

const router = express.Router();

router.get('/orders/today', verifyToken('partner'), asyncHandler(async (req, res) => {
  const today = getISTDateString();
  const orders = await Order.find({
    partner_id: req.user.id,
    delivery_date: today,
    status: { $ne: 'cancelled' },
  })
    .populate('customer_id', 'name phone address_line1 address_line2 area landmark pincode meal_preference special_instructions')
    .sort({ 'customer_id.area': 1, 'customer_id.name': 1 });
  console.log(req.user.id)

  const serializedOrders = orders.map((order) => {
    const item = serializeDoc(order);
    item.customer_name = order.customer_id?.name || null;
    item.phone = order.customer_id?.phone || null;
    item.address_line1 = order.customer_id?.address_line1 || null;
    item.address_line2 = order.customer_id?.address_line2 || null;
    item.area = order.customer_id?.area || null;
    item.landmark = order.customer_id?.landmark || null;
    item.pincode = order.customer_id?.pincode || null;
    item.meal_preference = order.customer_id?.meal_preference || null;
    item.special_instructions = order.customer_id?.special_instructions || null;
    return item;
  });

  res.json({ orders: serializedOrders, date: today });
}));

router.put('/orders/:id/status', verifyToken('partner'), asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validTransitions = { conformed: 'picked_up', picked_up: 'in_transit', in_transit: 'delivered' };
  const tsFieldMap = {
    confirmed: 'status_confirmed_at',
    picked_up: 'status_picked_up_at',
    in_transit: 'status_in_transit_at',
    delivered: 'status_delivered_at'
  };
  const order = await Order.findOne({ _id: req.params.id, partner_id: req.user.id });
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });

  const nextStatus = validTransitions[order.status];
  if (!nextStatus || nextStatus !== status) {
    return res.status(400).json({ error: 'INVALID_TRANSITION', message: `Cannot move from ${order.status} to ${status}` });
  }

  order.status = status;
  const tsField = tsFieldMap[status];
  if (tsField && !order[tsField]) {
    order[tsField] = new Date();
  }


  await order.save();

  onOrderStatusChange(order, status).catch(() => { });

  res.json({ success: true, status });
}));

router.put('/duty', verifyToken('partner'), asyncHandler(async (req, res) => {
  const { isOnDuty } = req.body;
  await DeliveryPartner.updateOne({ _id: req.user.id }, { $set: { is_on_duty: !!isOnDuty } });
  res.json({ success: true, isOnDuty: !!isOnDuty });
}));

router.get('/profile', verifyToken('partner'), asyncHandler(async (req, res) => {
  const partner = await DeliveryPartner.findById(req.user.id);
  console.log(serializeDoc(partner))
  res.json({ partner: partner ? serializeDoc(partner) : null });
}));

router.get('/', verifyToken('admin'), asyncHandler(async (_req, res) => {
  const today = getISTDateString();
  const partners = await DeliveryPartner.find().sort({ name: 1 });
  const partnerIds = partners.map((partner) => partner._id);

  const stats = await Order.aggregate([
    {
      $match: {
        partner_id: { $in: partnerIds },
        delivery_date: today,
      },
    },
    {
      $group: {
        _id: '$partner_id',
        today_total: {
          $sum: {
            $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0],
          },
        },
        today_delivered: {
          $sum: {
            $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0],
          },
        },
      },
    },
  ]);

  const statMap = new Map(stats.map((item) => [String(item._id), item]));
  const serializedPartners = partners.map((partner) => {
    const item = serializeDoc(partner);
    const stat = statMap.get(item.id);
    item.today_total = stat?.today_total || 0;
    item.today_delivered = stat?.today_delivered || 0;
    return item;
  });

  res.json({ partners: serializedPartners });
}));

router.post('/', verifyToken('admin'),
  body('name').notEmpty(),
  body('phone').isLength({ min: 10, max: 10 }).isNumeric(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION_ERROR' });

    const { name, phone, vehicleType, areas } = req.body;
    phone = `+91${phone}`;
    try {
      const partner = await DeliveryPartner.create({
        name,
        phone,
        vehicle_type: vehicleType || 'bike',
        area_coverage: Array.isArray(areas) ? areas : [],
      });
      res.json({ success: true, partner: serializeDoc(partner) });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(400).json({ error: 'PHONE_EXISTS', message: 'Phone number already registered' });
      }
      throw error;
    }
  })
);

router.put('/:id', asyncHandler(async (req, res) => {
  const { status, isOnDuty, vehicleType, areas } = req.body;
  const update = {};

  if (status !== undefined) update.status = status;
  if (isOnDuty !== undefined) update.is_on_duty = isOnDuty;
  if (vehicleType !== undefined) update.vehicle_type = vehicleType;
  if (areas !== undefined) update.area_coverage = Array.isArray(areas) ? areas : [];
  console.log(update);
  if (!Object.keys(update).length) return res.status(400).json({ error: 'NO_FIELDS' });

  await DeliveryPartner.updateOne({ _id: req.params.id }, { $set: update });
  res.json({ success: true });
}));

module.exports = router;
