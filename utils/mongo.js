const mongoose = require('mongoose');

function serializeDoc(value) {
  if (Array.isArray(value)) return value.map(serializeDoc);
 if (
    value === null ||
    value === undefined ||
    typeof value !== 'object'
  ) {
    return value;
  }
  const plain = typeof value.toObject === 'function'
    ? value.toObject({ virtuals: true })
    : { ...value };

  if (plain._id) {
    plain.id = String(plain._id);
    delete plain._id;
  }

  delete plain.__v;

  for (const [key, nested] of Object.entries(plain)) {
    if (Array.isArray(nested)) {
      plain[key] = nested.map(serializeDoc);
    } else if (nested && typeof nested === 'object') {
      if (nested instanceof Date) continue;
      if (mongoose.isValidObjectId(nested)) {
        plain[key] = String(nested);
      } else {
        plain[key] = serializeDoc(nested);
      }
    }
  }

  return plain;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { serializeDoc, escapeRegex };
