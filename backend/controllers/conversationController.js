const { Conversation, Group, view, listForUser, findAccessible, getOrCreatePrivate } = require("../services/conversation");
const User = require("../models/User");
const clean = (value, max) => String(value || "").trim().slice(0, max);

const list = async (req, res) => res.json({ rooms: await listForUser(req.user._id, clean(req.query.search, 60).toLowerCase()) });
const createRoom = async (req, res) => {
  const name = clean(req.body.name, 40);
  if (!name) return res.status(400).json({ error: "Enter a chat name." });
  const room = await Conversation.create({ type: "private", name, description: "Private conversation", members: [req.user._id], createdBy: req.user._id });
  res.status(201).json({ room: view(room, req.user._id) });
};
const privateConversation = async (req, res) => {
  const room = await getOrCreatePrivate(req.user._id, req.body.userId);
  const io = req.app.get("io");
  if (io) io.emit("rooms update");
  res.status(201).json({ room: view(room, req.user._id) });
};
const createGroup = async (req, res) => {
  const name = clean(req.body.name, 40);
  const ids = [...new Set([req.user._id.toString(), ...(Array.isArray(req.body.memberIds) ? req.body.memberIds : [])])];
  if (!name) return res.status(400).json({ error: "Enter a group name." });
  if (ids.length < 2 || (await User.countDocuments({ _id: { $in: ids } })) !== ids.length) return res.status(400).json({ error: "Select at least one valid other user." });
  const conversation = await Conversation.create({ type: "group", name, description: "Group conversation", members: ids, createdBy: req.user._id });
  await Group.create({ name, members: ids, createdBy: req.user._id, conversation: conversation._id });
  const io = req.app.get("io");
  if (io) io.emit("rooms update");
  res.status(201).json({ room: view(conversation, req.user._id) });
};
const messages = async (req, res) => {
  const conversation = await findAccessible(req.params.roomId, req.user._id);
  if (!conversation) return res.status(403).json({ error: "You do not have access to this chat." });
  const { history } = require("../services/message");
  res.json({ room: view(conversation, req.user._id), messages: await history(conversation._id) });
};

module.exports = { list, createRoom, privateConversation, createGroup, messages };
