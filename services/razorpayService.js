const Razorpay = require("razorpay");
const crypto = require("crypto");

let razorpayInstance = null;

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ CREATE ORDER (used in /create-order route)
async function createOrder({ amount, receipt, notes }) {
  const isMock = process.env.RAZORPAY_MOCK === 'true';

  const order = await instance.orders.create({
    amount: Number(amount)*100, // convert ₹ to paise
    currency: 'INR',
    receipt,
    notes
  });

  return order;
}

// ✅ VERIFY SIGNATURE (used in /verify route)
function verifySignature({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) return false;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return expectedSignature === razorpay_signature;
}

module.exports = {
  createOrder,
  verifySignature,
  
};