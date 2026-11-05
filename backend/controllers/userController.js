const User = require("../models/User");
const { clean, publicUser, Session } = require("../services/auth");
const { isOnline } = require("../services/presence");

const presence = async () => {
  const users = await User.find({}, "username avatar");
  const online = users.filter((user) => isOnline(user._id)).length;
  return { registered: users.length, online, offline: users.length - online, users: users.map((user) => ({ id: user._id.toString(), username: user.username, avatar: user.avatar || "", online: isOnline(user._id) })) };
};
const getMe = async (req, res) => res.json({ user: publicUser(req.user) });
const stats = async (req, res) => res.json(await presence());
const users = async (req, res) => res.json(await presence());
const updateMe = async (req, res) => {
  const username = clean(req.body.username, 20);
  const bio = clean(req.body.bio, 160);
  const avatar = String(req.body.avatar || "");
  if (username && await User.exists({ _id: { $ne: req.user._id }, username: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") })) return res.status(409).json({ error: "That username is already in use." });
  if (avatar && (!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\r\n]+$/i.test(avatar) || avatar.length > 2_000_000)) return res.status(400).json({ error: "Profile picture must be a supported image smaller than 1.5 MB." });
  req.user.username = username || req.user.username;
  req.user.bio = bio;
  req.user.avatar = avatar || req.user.avatar || "";
  await req.user.save();
  const io = req.app.get("io");
  if (io) io.emit("presence update", await presence());
  res.json({ user: publicUser(req.user) });
};
const logoutUser = async (req, res) => {
  if (String(req.params.id) !== String(req.user._id)) return res.status(403).json({ error: "You can only log out your own account." });
  await Session.deleteOne({ token: req.authToken });
  res.json({ ok: true });
};
const removeUser = async (req, res) => {
  if (String(req.params.id) !== String(req.user._id)) return res.status(403).json({ error: "You can only remove your own account." });
  await Promise.all([
    Session.deleteMany({ user: req.user._id }),
    User.deleteOne({ _id: req.user._id })
  ]);
  res.json({ ok: true });
};

module.exports = { getMe, stats, users, updateMe, logoutUser, removeUser, presence };
