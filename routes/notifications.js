const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { Customer, DeliveryPartner, NotificationLog } = require('../models');
const { asyncHandler } = require('../utils/asyncHandler');
const { serializeDoc } = require('../utils/mongo');

const router = express.Router();

router.put('/customer/push-token', verifyToken('customer'), asyncHandler(async (req, res) => {
  const { pushToken } = req.body;
  if (!pushToken) return res.status(400).json({ error: 'Push token required' });
  await Customer.updateOne({ _id: req.user.id }, { $set: { push_token: pushToken } });
  res.json({ success: true });
}));

router.put('/partner/push-token', verifyToken('partner'), asyncHandler(async (req, res) => {
  const { pushToken } = req.body;
  if (!pushToken) return res.status(400).json({ error: 'Push token required' });
  await DeliveryPartner.updateOne({ _id: req.user.id }, { $set: { push_token: pushToken } });
  res.json({ success: true });
}));

router.get('/admin/notifications', verifyToken('admin'), asyncHandler(async (_req, res) => {
  const logs = await NotificationLog.find().sort({ created_at: -1 }).limit(100);
  res.json({ logs: serializeDoc(logs) });
}));

module.exports = router;
