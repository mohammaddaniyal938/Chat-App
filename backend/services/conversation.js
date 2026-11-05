const Conversation = require("../models/Conversation");
const Group = require("../models/Group");
const User = require("../models/User");

const canAccess = (conversation, userId) => Boolean(conversation && (conversation.type === "public" || conversation.members.some((member) => member.toString() === userId.toString())));
const view = (conversation, userId) => {
  const result = conversation.toObject ? conversation.toObject() : conversation;
  const memberObjects = result.members || [];
  const members = memberObjects.map((member) => member._id ? member._id.toString() : member.toString());
  if (result.type === "private") {
    const other = memberObjects.find((member) => (member._id ? member._id.toString() : member.toString()) !== userId.toString());
    result.name = other?.username || result.name;
    result.description = other ? `Private conversation with ${other.username}` : result.description;
  }
  return { ...result, id: result._id.toString(), public: result.type === "public", members };
};
const listForUser = async (userId, search = "") => {
  const conversations = await Conversation.find({ $or: [{ type: "public" }, { members: userId }] }).populate("members", "username");
  return conversations.map((conversation) => view(conversation, userId)).filter((conversation) => !search || conversation.name.toLowerCase().includes(search));
};
const findAccessible = async (id, userId) => {
  const conversation = await Conversation.findById(id).populate("members", "username");
  if (!canAccess(conversation, userId)) return null;
  return conversation;
};
const getOrCreatePrivate = async (userId, otherId) => {
  const other = await User.findById(otherId);
  if (!other || other._id.toString() === userId.toString()) throw Object.assign(new Error("Choose another registered user."), { status: 400 });
  const members = [userId, other._id].sort();
  let conversation = await Conversation.findOne({ type: "private", members: { $all: members, $size: 2 } }).populate("members", "username");
  if (!conversation) conversation = await Conversation.create({ type: "private", name: other.username, description: `Private conversation with ${other.username}`, members, createdBy: userId });
  return conversation;
};

module.exports = { Conversation, Group, canAccess, view, listForUser, findAccessible, getOrCreatePrivate };
