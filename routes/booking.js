const express = require('express');
const { body, validationResult } = require('express-validator');
const { loadCutoffHours, getMealAvailability, isCutoffPassed, getISTDateString } = require('../services/timeService');
const { verifyToken } = require('../middleware/auth');
const { Order, Subscription, DeliveryPartner } = require('../models');
const { asyncHandler } = require('../utils/asyncHandler');
const { serializeDoc } = require('../utils/mongo');

const router = express.Router();

router.get('/availability', (req, res) => {
  const availability2 = loadCutoffHours();
  const availability = getMealAvailability();
  console.log(availability2)
  res.json(availability);
});

router.post('/book', verifyToken('customer'),
  body('mealType').isIn(['lunch', 'dinner']),
  body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid data' });

    const { mealType, date, specialNote, profile } = req.body;
    const customerId = req.user.id;
    const today = getISTDateString();
    const targetDate = date || today;

    // 1. Location Matching Logic
    // We assume profile.address_line1 or a similar field contains the area name
    const userArea = profile?.area || profile?.address_line1;

    // Find one partner who covers this area, is on duty, and is active
    // const assignedPartner = await DeliveryPartner.findOne({
    //   area_coverage: { $in: [new RegExp(`^${userArea.trim()}$`, 'i')] },
    //   is_on_duty: true,
    //   status: 'active',      
    // });


    if (targetDate === today && isCutoffPassed(mealType)) {
      return res.status(400).json({
        error: 'CUTOFF_PASSED',
        message: `${mealType === 'lunch' ? 'Lunch' : 'Dinner'} booking over.Try again tomorrow.`,
      });
    }

    const sub = await Subscription.findOne({
      customer_id: customerId,
      status: 'active',
      start_date: { $lte: targetDate },
      end_date: { $gte: targetDate },
    }).sort({ created_at: -1 });

    if (!sub) {
      return res.status(400).json({ error: 'NO_SUBSCRIPTION', message: 'No active subscription found.' });
    }

    if (sub.meal_type !== 'both' && sub.meal_type !== mealType) {
      return res.status(400).json({ error: 'MEAL_NOT_IN_PLAN', message: `Meal type ${mealType} is not included in your subscription.` });
    }

    const mealStartDate = sub.meal_start_dates?.[mealType] || sub.start_date;
    if (mealStartDate && targetDate < mealStartDate) {
      return res.status(400).json({
        error: 'MEAL_NOT_STARTED',
        message: `${mealType === 'lunch' ? 'Lunch' : 'Dinner'} service starts on ${mealStartDate}.`,
      });
    }

    if (sub.pause_start && sub.pause_end && targetDate >= sub.pause_start && targetDate <= sub.pause_end) {
      return res.status(400).json({ error: 'SUBSCRIPTION_PAUSED', message: `Subscription ${sub.pause_start} to ${sub.pause_end} is paused.` });
    }

    const existing = await Order.findOne({ customer_id: customerId, meal_type: mealType, delivery_date: targetDate });
    if (existing) {
      return res.status(400).json({ error: 'ORDER_EXISTS', message: 'An order for this meal already exists.' });
    }

    const order = await Order.create({
      subscription_id: sub._id,
      customer_id: customerId,
      meal_type: mealType,
      delivery_date: targetDate,
      status: 'Confirmed',
      special_note: specialNote || null,
    });

    res.json({ success: true, order: serializeDoc(order) });
  })
);

module.exports = router;
