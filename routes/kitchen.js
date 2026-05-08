const express = require('express');
const { getISTDateString, isCutoffPassed } = require('../services/timeService');
const { generateKitchenListForDate, getKitchenList, getTodayKitchenSummary } = require('../services/kitchenService');
const { verifyToken } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/today', verifyToken('admin'), asyncHandler(async (_req, res) => {
  const today = getISTDateString();
  const summary = await getTodayKitchenSummary();

  res.json({
    date: today,
    lunchCutoffPassed: isCutoffPassed('lunch'),
    dinnerCutoffPassed: isCutoffPassed('dinner'),
    lunch: summary.lunch,
    dinner: summary.dinner,
  });
}));

router.get('/:date/:meal', verifyToken('admin'), asyncHandler(async (req, res) => {
  const { date, meal } = req.params;
  if (!['lunch', 'dinner'].includes(meal)) return res.status(400).json({ error: 'INVALID_MEAL' });

  const list = await getKitchenList(date, meal);
  if (!list) return res.json({ exists: false, date, meal });

  res.json({ exists: true, ...list });
}));

router.post('/refresh', verifyToken('admin'), asyncHandler(async (req, res) => {
  const { date, meal } = req.body;
  const targetDate = date || getISTDateString();
  const meals = meal ? [meal] : ['lunch', 'dinner'];
  const results = {};

  for (const item of meals) {
    results[item] = await generateKitchenListForDate(targetDate, item, true);
  }

  res.json({ success: true, date: targetDate, results });
}));

module.exports = router;
