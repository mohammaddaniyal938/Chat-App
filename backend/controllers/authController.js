const { User, Session, normalizeEmail, clean, hashPassword, publicUser, createSession, passwordMatches } = require("../services/auth");

const signup = async (req, res) => {
  const username = clean(req.body.username, 20);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  if (!username || !/^[^\s@]+@gmail\.com$/i.test(email) || password.length < 6) return res.status(400).json({ error: "Enter a valid Gmail address and a password of at least 6 characters." });
  if (await User.exists({ email })) return res.status(409).json({ error: "That Gmail address is already registered. Please log in." });
  if (await User.exists({ username: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") })) return res.status(409).json({ error: "That username is already in use." });
  const user = await User.create({ username, email, ...hashPassword(password) });
  res.status(201).json({ token: await createSession(user), user: publicUser(user) });
};

const login = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const user = await User.findOne({ email });
  if (!user || !passwordMatches(password, user)) return res.status(401).json({ error: "Incorrect email or password." });
  res.json({ token: await createSession(user), user: publicUser(user) });
};

const logout = async (req, res) => {
  await Session.deleteOne({ token: req.authToken });
  res.json({ ok: true });
};

module.exports = { signup, login, logout };
