const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { addDays, getISTDateString, isCutoffPassed } = require('../services/timeService');
const { getRazorpay, createOrder, verifySignature } = require('../services/razorpayService');
const { calculateCheckoutAmount, getCheckoutConfig } = require('../services/paymentConfigService');
const { verifyToken } = require('../middleware/auth');
const { PaymentAttempt, Subscription } = require('../models');
const { asyncHandler } = require('../utils/asyncHandler');
const { serializeDoc } = require('../utils/mongo');
const { PLAN_DURATIONS } = require('../config/constants');

const router = express.Router();


const Razorpay = require("razorpay");

// let razorpayInstance = null;


// const instance = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });
// router.post('/create-order', async (req, res) => {
//   const { amount } = req.body;
//   const order = await instance.orders.create({
//     amount: amount * 100, // convert ₹ to paise
//     currency: 'INR',
//     receipt: `receipt_${Date.now()}`,
//   });

//   res.json({ order_id: order.id, amount: order.amount });
// });


router.post('/create-order', verifyToken('customer'),
  body('planType').isIn(['monthly', 'trial']),
  body('mealType').isIn(['lunch', 'dinner', 'both']),
  body('couponCode').optional({ values: 'false' }).isString().isLength({ max: 50 }),
  body('subscriptionPlan.selectedStartDate').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('subscriptionPlan.mealStartDates').optional().isObject(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION_ERROR' });

    // const { planType, mealType, couponCode, subscriptionPlan = {} } = req.body;


    try {

      const {
        orderAmount,
        customerName,
        customerPhone,
        customerEmail,
        customer_id,
        planType, mealType, couponCode, subscriptionPlan = {}
      } = req.body;

      // const orderId = `ORDER_${Date.now()}`;
      // const request = {
      //   order_id: orderId,
      //   order_amount: Number(orderAmount).toFixed(2), // Fix: Convert to String with decimals
      //   order_currency: "INR",

      //   customer_details: {
      //     customer_id: customer_id,
      //     customer_name: customerName,
      //     customer_email: customerEmail,
      //     customer_phone: customerPhone ? String(customerPhone).trim() : "9999999999",
      //   },

      //   order_meta: {
      //     return_url:
      //       "https://test.cashfree.com/pgappsdemos/return.php?order_id={order_id}"
      //   },
      // };

      // console.log("REQUEST =>", request);

      // const response = await Cashfree.PGCreateOrder(
      //   "2022-09-01",
      //   request
      // );

      // console.log("RESPONSE =>", response.data);

      // return res.status(200).json({
      //   success: true,
      //   orderId,
      //   payment_session_id:
      //     response.data.payment_session_id,
      // });
    

      
      const { selectedStartDate } = subscriptionPlan;
      const mealStartDates = normalizeMealStartDates({
        mealType,
        selectedStartDate,
        mealStartDates: subscriptionPlan.mealStartDates,
      });

      validateStartDates({ mealType, selectedStartDate, mealStartDates });

      const durationDays = PLAN_DURATIONS[planType];
      const endDate = addDays(selectedStartDate, durationDays - 1);
      const { amount, baseAmount, appliedCoupon } = await calculateCheckoutAmount({
        planType,
        mealType,
        couponCode,
      });

      const order = await createOrder({
        amount:orderAmount,
        notes: {
          customerId: String(req.user.id),
          planType,
          mealType,
          startDate: selectedStartDate,
        },
      });

      await PaymentAttempt.create({
        customer_id: req.user.id,
        plan_type: planType,
        meal_type: mealType,
        coupon_code: appliedCoupon?.code || null,
        base_amount: baseAmount,
        amount: order.amount,
        currency: order.currency || 'INR',
        receipt:order.receipt,
        razorpay_order_id: order.id,
        start_date: selectedStartDate,
        end_date: endDate,
        meal_start_dates: mealStartDates,
        status: 'created',
      });

      res.json({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency || 'INR',
        keyId: process.env.RAZORPAY_KEY_ID || '',
        isMock: true,
      });  

    } catch (error) {

      console.log(error?.response?.data || error);

      return res.status(500).json({
        success: false,
        message: 'Order creation failed',
      });
    }



  })
);
// router.post('/verify-payment', (req, res) => {
//   const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

//   const generatedSignature = crypto
//     .createHmac('sha256', 'YOUR_KEY_SECRET')
//     .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//     .digest('hex');

//   if (generatedSignature === razorpay_signature) {
//     res.json({ success: true, message: 'Payment Verified ✅' });




//   } else {
//     res.status(400).json({ success: false, message: 'Invalid Signature ❌' });
//   }
// });



function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
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

router.get('/checkout-config', asyncHandler(async (_req, res) => {
  const config = await getCheckoutConfig();

  res.json({
    keyId: process.env.RAZORPAY_KEY_ID || '',
    isMock: process.env.RAZORPAY_MOCK === 'true',
    currency: 'INR',
    prices: config.prices,
    coupons: config.coupons,
  });
}));




router.post('/verify-payment', verifyToken('customer'),
  body('razorpay_payment_id').notEmpty(),
  body('razorpay_order_id').notEmpty(),
  body('razorpay_signature').notEmpty(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION_ERROR' });

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const paymentAttempt = await PaymentAttempt.findOne({
      customer_id: req.user.id,
      razorpay_order_id,
    }).sort({ created_at: -1 });

    if (!paymentAttempt) {
      return res.status(404).json({ error: 'PAYMENT_NOT_FOUND', message: 'Payment order not found' });
    }

    if (paymentAttempt.status === 'paid' && paymentAttempt.subscription_id) {
      const existingSubscription = await Subscription.findById(paymentAttempt.subscription_id);
      if (existingSubscription) {
        return res.json({ success: true, subscription: serializeDoc(existingSubscription) });
      }
    }

    const isMock = process.env.RAZORPAY_MOCK === 'true' || razorpay_order_id.startsWith('mock_order_');
    const valid = isMock || verifySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: razorpay_signature || '',
    });

    if (!valid) {
      paymentAttempt.status = 'verification_failed';
      paymentAttempt.razorpay_payment_id = razorpay_payment_id;
      paymentAttempt.razorpay_signature = razorpay_signature || null;
      await paymentAttempt.save();

      return res.status(400).json({ error: 'INVALID_SIGNATURE', message: 'Payment verification failed' });
    }

    await Subscription.updateMany(
      { customer_id: req.user.id, status: { $in: ['active', 'paused'] } },
      { $set: { status: 'cancelled' } }
    );

    const subscription = await Subscription.create({
      customer_id: req.user.id,
      plan_type: paymentAttempt.plan_type,
      meal_type: paymentAttempt.meal_type,
      start_date: paymentAttempt.start_date,
      end_date: paymentAttempt.end_date,
      meal_start_dates: paymentAttempt.meal_start_dates,
      status: 'active',
      amount_paid: paymentAttempt.amount / 100,
      payment_id: razorpay_payment_id,
      razorpay_order_id,
    });

    paymentAttempt.status = 'paid';
    paymentAttempt.razorpay_payment_id = razorpay_payment_id;
    paymentAttempt.razorpay_signature = razorpay_signature || null;
    paymentAttempt.subscription_id = subscription._id;
    paymentAttempt.verified_at = new Date();
    await paymentAttempt.save();

    res.json({ success: true, subscription: serializeDoc(subscription) });
  })
);

module.exports = router;

