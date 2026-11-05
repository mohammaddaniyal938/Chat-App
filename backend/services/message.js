const Message = require("../models/Message");

const serialize = (message) => ({
  id: message._id.toString(),
  roomId: message.conversation.toString(),
  username: message.sender.username,
  senderId: message.sender._id.toString(),
  message: message.text,
  time: message.createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  createdAt: message.createdAt.toISOString()
});
const history = async (conversationId) => {
  const messages = await Message.find({ conversation: conversationId }).sort({ createdAt: 1 }).limit(100).populate("sender", "username");
  return messages.map(serialize);
};
const create = async (conversationId, user, text) => {
  const message = await Message.create({ conversation: conversationId, sender: user._id, text });
  await message.populate("sender", "username");
  return serialize(message);
};

module.exports = { Message, history, create, serialize };
