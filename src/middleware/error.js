function notFound(req, res, next) {
  res.status(404).json({ error: "Not found" });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || "Server error";
  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
