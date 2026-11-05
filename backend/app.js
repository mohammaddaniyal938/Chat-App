const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const conversationRoutes = require("./routes/conversations");
const privateRoutes = require("./routes/private");
const groupRoutes = require("./routes/groups");
const { notFound, errorHandler } = require("./middleware/errors");

const createApp = (origin) => {
  const app = express();
  const allowedOrigins = String(origin).split(",").map((value) => value.trim()).filter(Boolean);
  app.use(cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by the server CORS policy."));
    },
    credentials: true
  }));
  app.use(express.json({ limit: "3mb" }));
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api", userRoutes);
  app.use("/api/rooms", conversationRoutes);
  app.use("/api/conversations", privateRoutes);
  app.use("/api/groups", groupRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
};

module.exports = createApp;
