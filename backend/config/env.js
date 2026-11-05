require("dotenv").config();

const env = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/socket-chat",
  frontendOrigin: process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173",
  sessionDays: Number(process.env.SESSION_DAYS || 30)
};

module.exports = env;
