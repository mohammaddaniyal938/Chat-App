const notFound = (req, res) => res.status(404).json({ error: "Route not found." });

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 11000) return res.status(409).json({ error: "That value is already in use." });
  if (error.name === "ValidationError") return res.status(400).json({ error: "The submitted data is invalid." });
  if (error.name === "CastError") return res.status(400).json({ error: "The requested resource id is invalid." });
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: "An unexpected server error occurred." });
};

module.exports = { notFound, errorHandler };
