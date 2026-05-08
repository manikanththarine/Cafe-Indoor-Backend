const mongoose = require('mongoose');

function transformDoc(_doc, ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
}

function baseOptions(overrides = {}) {
  return {
    versionKey: false,
    toJSON: { virtuals: true, transform: transformDoc },
    toObject: { virtuals: true, transform: transformDoc },
    ...overrides,
  };
}

const adminUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password_hash: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, default: 'admin' },
}, baseOptions({ timestamps: { createdAt: 'created_at', updatedAt: false } }));

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  address_line1: { type: String, default: null },
  address_line2: { type: String, default: null },
  area: { type: String, default: 'Other' },
  landmark: { type: String, default: null },
  city: { type: String, default: 'Indore' },
  pincode: { type: String, default: null },
  meal_preference: { type: String, default: 'veg' },
  special_instructions: { type: String, default: null },
  push_token: { type: String, default: null },
  role: { type: String, default: 'customer' },
}, baseOptions({ timestamps: { createdAt: 'created_at', updatedAt: false } }));

const deliveryPartnerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  vehicle_type: { type: String, default: 'bike' },
  area_coverage: { type: [String], default: [] },
  status: { type: String, default: 'active' },
  is_on_duty: { type: Boolean, default: true },
  push_token: { type: String, default: null },
  role: { type: String, default: 'partner' },
}, baseOptions({ timestamps: { createdAt: 'created_at', updatedAt: false } }));

const subscriptionSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  plan_type: { type: String, required: true },
  meal_type: { type: String, required: true },
  start_date: { type: String, required: true },
  end_date: { type: String, required: true },
  meal_start_dates: {
    lunch: { type: String, default: null },
    dinner: { type: String, default: null },
  },
  status: { type: String, default: 'active' },
  amount_paid: { type: Number, default: 0 },
  payment_id: { type: String, default: null },
  razorpay_order_id: { type: String, default: null },
  pause_start: { type: String, default: null },
  pause_end: { type: String, default: null },
}, baseOptions({ timestamps: { createdAt: 'created_at', updatedAt: false } }));

const paymentAttemptSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  plan_type: { type: String, required: true },
  meal_type: { type: String, required: true },
  coupon_code: { type: String, default: null },
  base_amount: { type: Number, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  receipt: { type: String, required: true },
  razorpay_order_id: { type: String, required: true, unique: true, index: true },
  razorpay_payment_id: { type: String, default: null },
  razorpay_signature: { type: String, default: null },
  start_date: { type: String, required: true },
  end_date: { type: String, required: true },
  meal_start_dates: {
    lunch: { type: String, default: null },
    dinner: { type: String, default: null },
  },
  status: { type: String, default: 'created' },
  subscription_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  verified_at: { type: Date, default: null },
}, baseOptions({ timestamps: { createdAt: 'created_at', updatedAt: false } }));

const orderSchema = new mongoose.Schema({
  subscription_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  meal_type: { type: String, required: true },
  delivery_date: { type: String, required: true, index: true },
  status: { type: String, default: 'Pending' },
  partner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', default: null, index: true },
  special_note: { type: String, default: null },
  status_confirmed_at: { type: Date, default: null },
  status_picked_up_at: { type: Date, default: null },
  status_in_transit_at: { type: Date, default: null },
  status_delivered_at: { type: Date, default: null },
}, baseOptions({ timestamps: { createdAt: 'created_at', updatedAt: false } }));

orderSchema.index({ customer_id: 1, meal_type: 1, delivery_date: 1 }, { unique: true });

const kitchenPrepListSchema = new mongoose.Schema({
  prep_date: { type: String, required: true },
  meal_type: { type: String, required: true },
  total_count: { type: Number, default: 0 },
  veg_count: { type: Number, default: 0 },
  nonveg_count: { type: Number, default: 0 },
  jain_count: { type: Number, default: 0 },
  special_count: { type: Number, default: 0 },
  meal_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  generated_at: { type: Date, default: Date.now },
  is_manual_refresh: { type: Boolean, default: false },
}, baseOptions({ timestamps: false }));

kitchenPrepListSchema.index({ prep_date: 1, meal_type: 1 }, { unique: true });

const supportTicketSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  category: { type: String, default: 'other' },
  subject: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, default: 'open' },
  priority: { type: String, default: 'normal' },
}, baseOptions({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }));

const ticketMessageSchema = new mongoose.Schema({
  ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', required: true, index: true },
  sender_type: { type: String, required: true },
  sender_name: { type: String, default: null },
  content: { type: String, required: true },
  is_internal: { type: Boolean, default: false },
}, baseOptions({ timestamps: { createdAt: 'created_at', updatedAt: false } }));

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  value: { type: String, required: true },
  description: { type: String, default: null },
}, baseOptions({ timestamps: { createdAt: false, updatedAt: 'updated_at' } }));

const notificationLogSchema = new mongoose.Schema({
  recipient_type: { type: String, required: true },
  recipient_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, default: 'sent' },
}, baseOptions({ timestamps: { createdAt: 'created_at', updatedAt: false } }));

const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema, 'admin_users');
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema, 'customers');
const DeliveryPartner = mongoose.models.DeliveryPartner || mongoose.model('DeliveryPartner', deliveryPartnerSchema, 'delivery_partners');
const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema, 'subscriptions');
const PaymentAttempt = mongoose.models.PaymentAttempt || mongoose.model('PaymentAttempt', paymentAttemptSchema, 'payment_attempts');
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema, 'orders');
const KitchenPrepList = mongoose.models.KitchenPrepList || mongoose.model('KitchenPrepList', kitchenPrepListSchema, 'kitchen_prep_lists');
const SupportTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema, 'support_tickets');
const TicketMessage = mongoose.models.TicketMessage || mongoose.model('TicketMessage', ticketMessageSchema, 'ticket_messages');
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema, 'settings');
const NotificationLog = mongoose.models.NotificationLog || mongoose.model('NotificationLog', notificationLogSchema, 'notification_log');

module.exports = {
  AdminUser,
  Customer,
  DeliveryPartner,
  Subscription,
  PaymentAttempt,
  Order,
  KitchenPrepList,
  SupportTicket,
  TicketMessage,
  Setting,
  NotificationLog,
};
