// MUST be first line before any imports
process.env.TZ = 'Asia/Kolkata';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const { Subscription } = require('./models');
const { errorHandler } = require('./middleware/errorHandler');
const { initCronJobs } = require('./cron/index');
const { connectDB } = require('./config/database');


const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/booking');
const ordersRoutes = require('./routes/orders');
const kitchenRoutes = require('./routes/kitchen');
const customersRoutes = require('./routes/customers');
const subscriptionsRoutes = require('./routes/subscriptions');
const partnersRoutes = require('./routes/partners');
const supportRoutes = require('./routes/support');
const paymentsRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const notificationsRoutes = require('./routes/notifications');

const app = express();

app.use(express.json());

const cors = require('cors');

app.use(cors({
  origin: function (origin, callback) {

    // allow mobile apps, postman, expo native
    if (!origin) {
      return callback(null, true);
    }

    // localhost
    if (
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1')
    ) {
      return callback(null, true);
    }

    // expo
    if (
      origin.includes('expo.dev') ||
      origin.includes('exp.direct')
    ) {
      return callback(null, true);
    }

    // vercel frontend
    if (origin.includes('.vercel.app')) {
      return callback(null, true);
    }

    return callback(null, true);
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ]
}));

app.options('*', cors());









app.use('/api/auth', authRoutes);
app.use('/api/booking', bookingRoutes);
app.post('/api/orders/book', (req, res, next) => {
  req.url = '/book';
  bookingRoutes(req, res, next);
});
app.use('/api/orders', ordersRoutes);
app.use('/api/admin/kitchen', kitchenRoutes);
app.use('/api/customer/subscription', subscriptionsRoutes);
app.use('/api/customer', customersRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/partner', partnersRoutes);
app.use('/api/admin/partners', partnersRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/payment', paymentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', notificationsRoutes);

app.get('/api/health', (req, res) => {
  const { getISTDateString, getISTTimeString } = require('./services/timeService');
  res.json({ status: 'ok', time: getISTTimeString(), date: getISTDateString(), tz: process.env.TZ });
});

app.use(errorHandler);

let isConnected = false;

async function startServer() {
  if (!isConnected) {
    await connectDB();
    initCronJobs();

    console.log("MongoDB Connected");
    isConnected = true;
  }
}

app.use(async (req, res, next) => {
  await startServer();
  next();
});




cron.schedule('0 14 * * *', async () => {
  console.log('Running subscription resume job at 2 pm');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const pausedSubs = await Subscription.find({
      status: 'paused',
      pause_end: { $lt: today }
    });

    for (const sub of pausedSubs) {
      const pauseStart = new Date(sub.pause_start);
      const pauseEnd = new Date(sub.pause_end);

      // Calculate pause days
      const diffTime = pauseEnd - pauseStart;
      const pauseDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Extend end date
      const currentEndDate = new Date(sub.end_date);
      currentEndDate.setDate(currentEndDate.getDate() + pauseDays);

      sub.end_date = currentEndDate;
      sub.status = 'active';
      sub.pause_start = null;
      sub.pause_end = null;

      await sub.save();
    }

    console.log(`Updated ${pausedSubs.length} subscriptions`);
  } catch (err) {
    console.error('Cron job error:', err);
  }
});
module.exports = app;
