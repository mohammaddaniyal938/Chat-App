const crypto = require("crypto");
const User = require("../models/User");
const Session = require("../models/Session");
const env = require("../config/env");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const clean = (value, max) => String(value || "").trim().slice(0, max);
const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => ({
  salt,
  passwordHash: crypto.scryptSync(password, salt, 64).toString("hex")
});
const publicUser = (user) => ({ id: user._id.toString(), username: user.username, email: user.email, bio: user.bio || "", avatar: user.avatar || "" });
const createSession = async (user) => {
  const token = crypto.randomUUID();
  await Session.create({ token, user: user._id, expiresAt: new Date(Date.now() + env.sessionDays * 86400000) });
  return token;
};
const passwordMatches = (password, user) => {
  const expected = Buffer.from(user.passwordHash, "hex");
  const supplied = Buffer.from(hashPassword(password, user.salt).passwordHash, "hex");
  return expected.length === supplied.length && expected.length > 0 && crypto.timingSafeEqual(expected, supplied);
};

module.exports = { User, Session, normalizeEmail, clean, hashPassword, publicUser, createSession, passwordMatches };
