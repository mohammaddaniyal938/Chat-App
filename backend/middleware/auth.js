const Session = require("../models/Session");

const getToken = (req) => (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

const authenticate = async (req, res, next) => {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Please sign in to continue." });
    const session = await Session.findOne({ token }).populate("user");
    if (!session || session.expiresAt <= new Date() || !session.user) return res.status(401).json({ error: "Your session has expired." });
    req.authToken = token;
    req.user = session.user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authenticate, getToken };
