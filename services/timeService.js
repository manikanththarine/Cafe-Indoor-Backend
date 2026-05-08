// All IST timezone logic lives here. server.js sets process.env.TZ = 'Asia/Kolkata'
// so new Date() already returns IST-correct values.

const { CUTOFF_HOURS } = require('../config/constants');
const { Setting } = require('../models');


async function loadCutoffHours() {
  const [lunchSetting, dinnerSetting] = await Promise.all([
    Setting.findOne({ key: "lunch_cutoff" }),
    Setting.findOne({ key: "dinner_cutoff" }),
  ]);

  if (lunchSetting?.value) {
    const [hour, minute] = lunchSetting.value.split(":").map(Number);
    CUTOFF_HOURS.lunch.hour = hour;
    CUTOFF_HOURS.lunch.minute = minute;
  }

  if (dinnerSetting?.value) {
    const [hour, minute] = dinnerSetting.value.split(":").map(Number);
    CUTOFF_HOURS.dinner.hour = hour;
    CUTOFF_HOURS.dinner.minute = minute;
  }
}
function getISTNow() {
  return new Date();
}

function getISTDateString(date) {
  const d = date || getISTNow();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTomorrowISTDateString() {
  const tomorrow = new Date(getISTNow());
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getISTDateString(tomorrow);
}

function getISTTimeString(date) {
  const d = date || getISTNow();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function isCutoffPassed(mealType) {
  const now = getISTNow();
  const cutoff = CUTOFF_HOURS[mealType];
  if (!cutoff) return true;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const cutoffMinutes = cutoff.hour * 60 + cutoff.minute;
  return nowMinutes >= cutoffMinutes;
}

function secondsUntilCutoff(mealType) {
  const now = getISTNow();
  const cutoff = CUTOFF_HOURS[mealType];
  if (!cutoff) return 0;
  const cutoffDate = new Date(now);
  cutoffDate.setHours(cutoff.hour, cutoff.minute, 0, 0);
  const diff = cutoffDate.getTime() - now.getTime();
  return diff > 0 ? Math.floor(diff / 1000) : 0;
}

function getNextCutoffInfo() {
  const now = getISTNow();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const lunchCutoffMinutes = CUTOFF_HOURS.lunch.hour * 60 + CUTOFF_HOURS.lunch.minute;
  const dinnerCutoffMinutes = CUTOFF_HOURS.dinner.hour * 60 + CUTOFF_HOURS.dinner.minute;

  if (nowMinutes < lunchCutoffMinutes) {
    return {
      meal: 'lunch',
      secondsRemaining: secondsUntilCutoff('lunch'),
      isOpen: true,
      bothOpen: true,
    };
  } else if (nowMinutes < dinnerCutoffMinutes) {
    return {
      meal: 'dinner',
      secondsRemaining: secondsUntilCutoff('dinner'),
      isOpen: true,
      bothOpen: false,
      lunchLocked: true,
    };
  } else {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const secondsUntilMidnight = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
    return {
      meal: null,
      secondsRemaining: secondsUntilMidnight,
      isOpen: false,
      bothOpen: false,
      lunchLocked: true,
      dinnerLocked: true,
    };
  }
}

function getMealAvailability() {
  const now = getISTNow();
  const lunchPassed = isCutoffPassed('lunch');
  const dinnerPassed = isCutoffPassed('dinner');
  const next = getNextCutoffInfo();

  return {
    lunch: {
      available: !lunchPassed,
      cutoffTime: `${String(CUTOFF_HOURS.lunch.hour).padStart(2, '0')}:${String(CUTOFF_HOURS.lunch.minute).padStart(2, '0')}`,
      lockedAt: lunchPassed ? `${String(CUTOFF_HOURS.lunch.hour).padStart(2, '0')}:${String(CUTOFF_HOURS.lunch.minute).padStart(2, '0')}` : null,
    },
    dinner: {
      available: !dinnerPassed,
      cutoffTime: `${String(CUTOFF_HOURS.dinner.hour).padStart(2, '0')}:${String(CUTOFF_HOURS.dinner.minute).padStart(2, '0')}`,
      lockedAt: dinnerPassed ? `${String(CUTOFF_HOURS.dinner.hour).padStart(2, '0')}:${String(CUTOFF_HOURS.dinner.minute).padStart(2, '0')}` : null,
    },
    serverTime: now.toISOString(),
    istTimeDisplay: getISTTimeString(),
    istDateDisplay: getISTDateString(),
    nextCutoff: next,
  };
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return getISTDateString(d);
}

module.exports = {
  loadCutoffHours,
  getISTNow,
  getISTDateString,
  getTomorrowISTDateString,
  getISTTimeString,
  isCutoffPassed,
  secondsUntilCutoff,
  getNextCutoffInfo,
  getMealAvailability,
  addDays,
};
