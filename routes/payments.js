const express = require('express');
const crypto = require('crypto');
const { addDays, getISTDateString, isCutoffPassed } = require('../services/timeService');
const { calculateCheckoutAmount, getCheckoutConfig } = require('../services/paymentConfigService');
const { verifyToken } = require('../middleware/auth');
const { PaymentAttempt, Subscription } = require('../models');
const { asyncHandler } = require('../utils/asyncHandler');
const { serializeDoc } = require('../utils/mongo');
const { PLAN_DURATIONS } = require('../config/constants');
const Razorpay = require('razorpay');

const router = express.Router();

// ─────────────────────────────────────────────
// Razorpay Instance
// ─────────────────────────────────────────────
const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function isValidDateString(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
  );
}

function normalizeMealStartDates({ mealType, selectedStartDate, mealStartDates = {} }) {
  const normalized = {
    lunch: mealType === 'dinner' ? null : mealStartDates?.lunch || selectedStartDate,
    dinner: mealType === 'lunch' ? null : mealStartDates?.dinner || selectedStartDate,
  };

  if (normalized.lunch && !isValidDateString(normalized.lunch)) {
    const error = new Error('Invalid lunch start date');
    error.status = 400;
    error.code = 'INVALID_START_DATE';
    throw error;
  }

  if (normalized.dinner && !isValidDateString(normalized.dinner)) {
    const error = new Error('Invalid dinner start date');
    error.status = 400;
    error.code = 'INVALID_START_DATE';
    throw error;
  }

  if (normalized.lunch && normalized.lunch < selectedStartDate) {
    const error = new Error('Lunch start date cannot be before the subscription start date');
    error.status = 400;
    error.code = 'INVALID_START_DATE';
    throw error;
  }

  if (normalized.dinner && normalized.dinner < selectedStartDate) {
    const error = new Error('Dinner start date cannot be before the subscription start date');
    error.status = 400;
    error.code = 'INVALID_START_DATE';
    throw error;
  }

  return normalized;
}

function validateStartDates({ mealType, selectedStartDate, mealStartDates }) {
  const today = getISTDateString();

  if (!isValidDateString(selectedStartDate) || selectedStartDate < today) {
    const error = new Error('Invalid subscription start date');
    error.status = 400;
    error.code = 'INVALID_START_DATE';
    throw error;
  }

  if (mealStartDates.lunch === today && isCutoffPassed('lunch')) {
    const error = new Error('Lunch cannot start today because the cutoff has passed');
    error.status = 400;
    error.code = 'LUNCH_CUTOFF_PASSED';
    throw error;
  }

  if (mealStartDates.dinner === today && isCutoffPassed('dinner')) {
    const error = new Error('Dinner cannot start today because the cutoff has passed');
    error.status = 400;
    error.code = 'DINNER_CUTOFF_PASSED';
    throw error;
  }

  if (mealType === 'lunch' && !mealStartDates.lunch) {
    const error = new Error('Lunch start date is required');
    error.status = 400;
    error.code = 'INVALID_START_DATE';
    throw error;
  }

  if (mealType === 'dinner' && !mealStartDates.dinner) {
    const error = new Error('Dinner start date is required');
    error.status = 400;
    error.code = 'INVALID_START_DATE';
    throw error;
  }
}

// ─────────────────────────────────────────────
// GET /payment/checkout-config
// ─────────────────────────────────────────────
router.get(
  '/checkout-config',
  asyncHandler(async (_req, res) => {
    const config = await getCheckoutConfig();

    return res.json({
      keyId: process.env.RAZORPAY_KEY_ID || '',
      isMock: process.env.RAZORPAY_MOCK === 'true',
      currency: 'INR',
      prices: config.prices,
      coupons: config.coupons,
    });
  })
);

// ─────────────────────────────────────────────
// POST /payment/create-order
// ─────────────────────────────────────────────
router.post(
  '/create-order',
  verifyToken('customer'),
  asyncHandler(async (req, res) => {
    const {
      orderAmount,
      planType,
      mealType,
      couponCode,
      subscriptionPlan = {},
    } = req.body;

    // 1. Validate & normalize dates
    const { selectedStartDate } = subscriptionPlan;

    const mealStartDates = normalizeMealStartDates({
      mealType,
      selectedStartDate,
      mealStartDates: subscriptionPlan.mealStartDates,
    });

    validateStartDates({ mealType, selectedStartDate, mealStartDates });

    // 2. Calculate amount & coupon
    const { baseAmount, appliedCoupon } = await calculateCheckoutAmount({
      planType,
      mealType,
      couponCode,
    });

    // 3. Compute end date
    const durationDays = PLAN_DURATIONS[planType];
    const endDate = addDays(selectedStartDate, durationDays - 1);

    // 4. Create Razorpay order (amount in paise)
    const receipt = `ci_${req.user.id}_${Date.now()}`;

    const order = await instance.orders.create({
      amount: Math.round(Number(orderAmount) * 100), // ₹ → paise
      currency: 'INR',
      receipt,
    });

    // 5. Save PaymentAttempt
    await PaymentAttempt.create({
      customer_id: req.user.id,
      plan_type: planType,
      meal_type: mealType,
      coupon_code: appliedCoupon?.code || null,
      base_amount: baseAmount,
      amount: order.amount,           // already in paise from Razorpay
      currency: order.currency || 'INR',
      receipt,
      razorpay_order_id: order.id,
      start_date: selectedStartDate,
      end_date: endDate,
      meal_start_dates: mealStartDates,
      status: 'created',
    });

    // 6. Return order details to frontend
    return res.json({
      order_id: order.id,
      amount: order.amount,           // paise — frontend passes this to Razorpay SDK as-is
      currency: order.currency || 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || '',
    });
  })
);

// ─────────────────────────────────────────────
// POST /payment/verify-payment
// ─────────────────────────────────────────────
router.post(
  '/verify-payment',
  verifyToken('customer'),
  asyncHandler(async (req, res) => {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required',
      });
    }

    // 1. Find PaymentAttempt
    const paymentAttempt = await PaymentAttempt.findOne({
      customer_id: req.user.id,
      razorpay_order_id,
    }).sort({ created_at: -1 });

    if (!paymentAttempt) {
      return res.status(404).json({
        success: false,
        error: 'PAYMENT_NOT_FOUND',
        message: 'Payment order not found',
      });
    }

    // 2. Already paid — return existing subscription (idempotent)
    if (paymentAttempt.status === 'paid' && paymentAttempt.subscription_id) {
      const existingSubscription = await Subscription.findById(
        paymentAttempt.subscription_id
      );

      if (existingSubscription) {
        return res.json({
          success: true,
          message: 'Payment already verified ✅',
          subscription: serializeDoc(existingSubscription),
        });
      }
    }

    // 3. Verify Razorpay signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      paymentAttempt.status = 'verification_failed';
      paymentAttempt.razorpay_payment_id = razorpay_payment_id;
      paymentAttempt.razorpay_signature = razorpay_signature || null;
      await paymentAttempt.save();

      return res.status(400).json({
        success: false,
        error: 'INVALID_SIGNATURE',
        message: 'Payment verification failed ❌',
      });
    }

    // 4. Cancel any existing active/paused subscriptions
    await Subscription.updateMany(
      {
        customer_id: req.user.id,
        status: { $in: ['active', 'paused'] },
      },
      { $set: { status: 'cancelled' } }
    );

    // 5. Create new Subscription
    const subscription = await Subscription.create({
      customer_id: req.user.id,
      plan_type: paymentAttempt.plan_type,
      meal_type: paymentAttempt.meal_type,
      start_date: paymentAttempt.start_date,
      end_date: paymentAttempt.end_date,
      meal_start_dates: paymentAttempt.meal_start_dates,
      status: 'active',
      amount_paid: paymentAttempt.amount / 100,   // paise → ₹
      payment_id: razorpay_payment_id,
      razorpay_order_id,
    });

    // 6. Mark PaymentAttempt as paid
    paymentAttempt.status = 'paid';
    paymentAttempt.razorpay_payment_id = razorpay_payment_id;
    paymentAttempt.razorpay_signature = razorpay_signature || null;
    paymentAttempt.subscription_id = subscription._id;
    paymentAttempt.verified_at = new Date();
    await paymentAttempt.save();

    // 7. Return success with subscription
    return res.json({
      success: true,
      message: 'Payment Verified ✅',
      subscription: serializeDoc(subscription),
    });
  })
);

module.exports = router;