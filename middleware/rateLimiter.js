const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many OTP requests. Please try again after 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'RATE_LIMIT', message: 'Too many requests. Please wait a moment.' },
});

module.exports = { otpLimiter, apiLimiter };
