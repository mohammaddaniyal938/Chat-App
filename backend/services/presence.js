const onlineUsers = new Map();

const setOnline = (userId) => onlineUsers.set(userId.toString(), (onlineUsers.get(userId.toString()) || 0) + 1);
const setOffline = (userId) => {
  const key = userId.toString();
  const count = onlineUsers.get(key) || 1;
  if (count <= 1) onlineUsers.delete(key);
  else onlineUsers.set(key, count - 1);
};
const isOnline = (userId) => onlineUsers.has(userId.toString());

module.exports = { setOnline, setOffline, isOnline };
