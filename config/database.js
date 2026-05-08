const mongoose = require('mongoose');
const { Setting } = require('../models');

let connectionPromise;

async function initializeDefaults() {
  const defaults = [
    { key: 'lunch_cutoff', value: '09:00', description: 'Lunch order cutoff time (HH:MM IST)' },
    { key: 'dinner_cutoff', value: '16:00', description: 'Dinner order cutoff time (HH:MM IST)' },
    { key: 'monthly_both_price', value: '480000', description: 'Monthly both meals price in paise' },
    { key: 'monthly_single_price', value: '288000', description: 'Monthly single meal price in paise' },
    { key: 'trial_both_price', value: '140000', description: 'Trial both meals price in paise' },
    { key: 'trial_single_price', value: '84000', description: 'Trial single meal price in paise' },
    { key: 'closed_dates', value: '[]', description: 'JSON array of closed dates YYYY-MM-DD' },
    {
      key: 'coupons',
      value: '[{"code":"INDOORI10","type":"percent","value":10},{"code":"TRIAL50","type":"flat","value":5000}]',
      description: 'Active coupons JSON',
    },
  ];

  await Promise.all(defaults.map((setting) => (
    Setting.updateOne(
      { key: setting.key },
      { $setOnInsert: setting },
      { upsert: true }
    )
  )));
}

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!connectionPromise) {
    const mongoUri = process.env.MONGO_URI;
    const options = {};

    if (process.env.MONGO_DB_NAME) {
      options.dbName = process.env.MONGO_DB_NAME;
    }

    connectionPromise = mongoose.connect(mongoUri, options)
      .then(async (conn) => {
        await initializeDefaults();
        return conn.connection;
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  return connectionPromise;
}

module.exports = { connectDB };
