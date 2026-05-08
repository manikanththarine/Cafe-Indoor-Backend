const { PLAN_PRICES } = require('../config/constants');
const { Setting } = require('../models');

const PRICE_SETTING_KEYS = {
  monthly: {
    lunch: 'monthly_single_price',
    dinner: 'monthly_single_price',
    both: 'monthly_both_price',
  },
  trial: {
    lunch: 'trial_single_price',
    dinner: 'trial_single_price',
    both: 'trial_both_price',
  },
};

const DEFAULT_PRICE_MAP = {
  monthly: {
    lunch: PLAN_PRICES.monthly_single,
    dinner: PLAN_PRICES.monthly_single,
    both: PLAN_PRICES.monthly_both,
  },
  trial: {
    lunch: PLAN_PRICES.trial_single,
    dinner: PLAN_PRICES.trial_single,
    both: PLAN_PRICES.trial_both,
  },
};

function normalizeCoupon(rawCoupon) {
  if (!rawCoupon || typeof rawCoupon !== 'object') return null;

  const code = String(rawCoupon.code || '').trim().toUpperCase();
  const type = String(rawCoupon.type || '').trim().toLowerCase();
  const value = Number(rawCoupon.value);

  if (!code || !['percent', 'flat'].includes(type) || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return {
    code,
    type,
    value,
    description: rawCoupon.description ? String(rawCoupon.description) : '',
  };
}

function parseCoupons(value) {
  if (!value) return [];

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCoupon).filter(Boolean);
  } catch (_error) {
    return [];
  }
}

async function getCheckoutConfig() {
  const settings = await Setting.find({
    key: {
      $in: [
        'monthly_both_price',
        'monthly_single_price',
        'trial_both_price',
        'trial_single_price',
        'coupons',
      ],
    },
  });

  const settingsByKey = {};
  settings.forEach((setting) => {
    settingsByKey[setting.key] = setting.value;
  });

  const prices = {
    monthly: {
      lunch: Number(settingsByKey.monthly_single_price) || DEFAULT_PRICE_MAP.monthly.lunch,
      dinner: Number(settingsByKey.monthly_single_price) || DEFAULT_PRICE_MAP.monthly.dinner,
      both: Number(settingsByKey.monthly_both_price) || DEFAULT_PRICE_MAP.monthly.both,
    },
    trial: {
      lunch: Number(settingsByKey.trial_single_price) || DEFAULT_PRICE_MAP.trial.lunch,
      dinner: Number(settingsByKey.trial_single_price) || DEFAULT_PRICE_MAP.trial.dinner,
      both: Number(settingsByKey.trial_both_price) || DEFAULT_PRICE_MAP.trial.both,
    },
  };

  return {
    prices,
    coupons: parseCoupons(settingsByKey.coupons),
  };
}

async function calculateCheckoutAmount({ planType, mealType, couponCode }) {
  const config = await getCheckoutConfig();
  const baseAmount = config.prices?.[planType]?.[mealType];

  if (!Number.isFinite(baseAmount)) {
    const error = new Error('Invalid plan configuration');
    error.status = 400;
    error.code = 'INVALID_PLAN';
    throw error;
  }

  let amount = baseAmount;
  let appliedCoupon = null;

  if (couponCode) {
    const normalizedCode = String(couponCode).trim().toUpperCase();
    const coupon = config.coupons.find((item) => item.code === normalizedCode);

    if (!coupon) {
      const error = new Error('Invalid coupon code');
      error.status = 400;
      error.code = 'INVALID_COUPON';
      throw error;
    }

    appliedCoupon = coupon;

    if (coupon.type === 'percent') {
      amount = Math.floor(baseAmount * (1 - coupon.value / 100));
    } else {
      amount = Math.max(0, baseAmount - coupon.value);
    }
  }

  return {
    baseAmount,
    amount,
    appliedCoupon,
    config,
  };
}

module.exports = {
  PRICE_SETTING_KEYS,
  getCheckoutConfig,
  calculateCheckoutAmount,
  parseCoupons,
};
