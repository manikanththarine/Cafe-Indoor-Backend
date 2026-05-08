const jwt = require('jsonwebtoken');

function verifyToken(role) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token required' });
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (role && payload.role !== role) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
      }
      req.user = payload;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token invalid ya expired' });
    }
  };
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

module.exports = { verifyToken, signToken };
