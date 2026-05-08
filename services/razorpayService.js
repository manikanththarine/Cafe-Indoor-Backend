const Razorpay = require("razorpay");
const crypto = require("crypto");

let razorpayInstance = null;

function getRazorpay() {
  if (!razorpayInstance) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      console.warn("Razorpay keys missing");
      return null;
    }

    razorpayInstance = new Razorpay({
      key_id,
      key_secret,
    });
  }
  return razorpayInstance;
}

// ✅ CREATE ORDER (used in /create-order route)
async function createOrder({ amount, receipt, notes }) {
  const isMock = process.env.RAZORPAY_MOCK === 'true';
  const rzp = getRazorpay();

  if (isMock || !rzp) {
    return {
      id: "mock_order_" + Date.now(),
      amount: Math.round(amount * 100),
      currency: "INR",
      mock: true,
    };
  }

  const order = await rzp.orders.create({
    amount: Math.round(amount * 100), // convert rupees to paise
    currency: "INR",
    receipt,
    notes,
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
  getRazorpay
};