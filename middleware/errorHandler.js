function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message, err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: err.code || 'SERVER_ERROR',
    message: err.message || 'Something went wrong. Please try again.',
  });
}

module.exports = { errorHandler };
