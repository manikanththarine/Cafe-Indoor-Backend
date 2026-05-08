// In-memory OTP store with TTL. Not persisted to DB.
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 3;
const MAX_SENDS_PER_WINDOW = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000;

const otpStore = new Map(); // phone -> { otp, expiresAt, attempts }
const sendCountStore = new Map(); // phone -> { count, windowStart }

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [phone, data] of otpStore) {
    if (data.expiresAt < now) otpStore.delete(phone);
  }
  for (const [phone, data] of sendCountStore) {
    if (data.windowStart + SEND_WINDOW_MS < now) sendCountStore.delete(phone);
  }
}, 5 * 60 * 1000);

function generateOtp() {
  if (process.env.NODE_ENV === 'development') return '123456';
  return String(Math.floor(100000 + Math.random() * 900000));

  
}

function canSendOtp(phone) {
  const now = Date.now();
  const record = sendCountStore.get(phone);
  if (!record) return true;
  if (now - record.windowStart > SEND_WINDOW_MS) return true;
  return record.count < MAX_SENDS_PER_WINDOW;
}

function sendOtp(phone) {
  if (!canSendOtp(phone)) {
    return { success: false, error: 'TOO_MANY_REQUESTS', message: 'Too many OTP requests. Please try again after 10 minutes.' };
  }

  const otp = generateOtp();
  const now = Date.now();

  otpStore.set(phone, { otp, expiresAt: now + OTP_EXPIRY_MS, attempts: 0 });

  const record = sendCountStore.get(phone);
  if (!record || now - record.windowStart > SEND_WINDOW_MS) {
    sendCountStore.set(phone, { count: 1, windowStart: now });
  } else {
    record.count++;
  }

  // In dev: log OTP
  if (process.env.NODE_ENV === 'development') {
    console.log(`[OTP] Phone: ${phone} → OTP: ${otp}`);
  }
  // In production: integrate SMS gateway here

  return { success: true, otp: process.env.NODE_ENV === 'development' ? otp : undefined };
}

function verifyOtp(phone, inputOtp) {
  const record = otpStore.get(phone);

  if (!record) {
    return { success: false, error: 'OTP_NOT_FOUND', message: 'OTP expired or not found. Please request a new OTP.' };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return { success: false, error: 'OTP_EXPIRED', message: 'OTP has expired. Please request a new OTP.' };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return { success: false, error: 'TOO_MANY_ATTEMPTS', message: 'Too many wrong OTP attempts. Please request a new OTP.' };
  }

  if (record.otp !== String(inputOtp)) {
    record.attempts++;
    return { success: false, error: 'WRONG_OTP', message: `Incorrect OTP. ${MAX_ATTEMPTS - record.attempts} attempt(s) remaining.` };
  }

  otpStore.delete(phone);
  return { success: true };
}

module.exports = { sendOtp, verifyOtp, canSendOtp };
