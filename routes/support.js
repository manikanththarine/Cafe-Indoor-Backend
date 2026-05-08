const express = require('express');
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const { SupportTicket, TicketMessage } = require('../models');
const { asyncHandler } = require('../utils/asyncHandler');
const { serializeDoc } = require('../utils/mongo');

const router = express.Router();

router.post('/tickets',verifyToken('customer'),
  body('subject').notEmpty().isLength({ max: 200 }),
  body('category').isIn(['delivery_issue', 'meal_quality', 'payment', 'subscription', 'other']),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION_ERROR' });

    const { subject, category, description, orderId } = req.body;
    const ticket = await SupportTicket.create({
      customer_id: req.user.id,
      order_id: orderId || null,
      category,
      subject,
      description: description || ''
    });

    await TicketMessage.create({
      ticket_id: ticket._id,
      sender_type: 'customer',
      sender_name: req.user.name || 'Customer',
      content: description || subject,
    });

    res.json({ success: true, ticket: serializeDoc(ticket) });
  })
);

router.get('/tickets',  asyncHandler(async (req, res) => {
  const tickets = await SupportTicket.find({ customer_id: req.user.id }).sort({ created_at: -1 });
  res.json({ tickets: serializeDoc(tickets) });
}));

router.get('/tickets/:id', asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, customer_id: req.user.id });
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });

  const messages = await TicketMessage.find({ ticket_id: req.params.id, is_internal: false }).sort({ created_at: 1 });
  res.json({ ticket: serializeDoc(ticket), messages: serializeDoc(messages) });
}));

router.post('/tickets/:id/messages',
  body('content').notEmpty(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION_ERROR' });

    const ticket = await SupportTicket.findOne({ _id: req.params.id, customer_id: req.user.id });
    if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });

    await TicketMessage.create({
      ticket_id: req.params.id,
      sender_type: 'customer',
      sender_name: req.user.name || 'Customer',
      content: req.body.content,
    });

    ticket.updated_at = new Date();
    await ticket.save();
    res.json({ success: true });
  })
);

router.get('/admin/tickets',  asyncHandler(async (req, res) => {
  const { status, priority, page = 1, limit = 50 } = req.query;
  const filters = {};
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  if (status) filters.status = status;
  if (priority) filters.priority = priority;

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filters)
      .populate('customer_id', 'name phone')
      .sort({ priority: -1, created_at: -1 })
      .skip(skip)
      .limit(limitNumber),
    SupportTicket.countDocuments(filters),
  ]);

  const serializedTickets = tickets.map((ticket) => {
    const item = serializeDoc(ticket);
    item.customer_name = ticket.customer_id?.name || null;
    item.phone = ticket.customer_id?.phone || null;
    return item;
  });

  res.json({ tickets: serializedTickets, total });
}));

router.get('/admin/tickets/:id', asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id).populate('customer_id', 'name phone');
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });

  const messages = await TicketMessage.find({ ticket_id: req.params.id }).sort({ created_at: 1 });
  const serializedTicket = serializeDoc(ticket);
  serializedTicket.customer_name = ticket.customer_id?.name || null;
  serializedTicket.phone = ticket.customer_id?.phone || null;

  res.json({ ticket: serializedTicket, messages: serializeDoc(messages) });
}));

router.put('/admin/tickets/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  await SupportTicket.updateOne({ _id: req.params.id }, { $set: { status, updated_at: new Date() } });
  res.json({ success: true });
}));

router.post('/admin/tickets/:id/reply', asyncHandler(async (req, res) => {
  const { content } = req.body;
  await TicketMessage.create({
    ticket_id: req.params.id,
    sender_type: 'agent',
    sender_name: 'Admin',
    content,
    is_internal: false,
  });

  await SupportTicket.updateOne({ _id: req.params.id }, { $set: { updated_at: new Date() } });
  res.json({ success: true });
}));


module.exports = router;
