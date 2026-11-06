const express = require("express");
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.CHAT_DB_FILE || path.join(__dirname, "data.json");

const readDb = () => {
  try {
    const stored = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return {
      users: Array.isArray(stored.users) ? stored.users : [],
      sessions: Array.isArray(stored.sessions) ? stored.sessions : [],
      rooms: Array.isArray(stored.rooms) ? stored.rooms : [],
      messages: Array.isArray(stored.messages) ? stored.messages : []
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { users: [], sessions: [], rooms: [{ id: "general", name: "General Chat", description: "Say hello to everyone in the room.", public: true, members: [] }], messages: [] };
  }
};
let db = readDb();
if (!db.rooms.some((room) => room.id === "general")) db.rooms.unshift({ id: "general", name: "General Chat", description: "Say hello to everyone in the room.", public: true, members: [] });
db.rooms.forEach((room) => { room.members = Array.isArray(room.members) ? room.members : []; });
db.users.forEach((user) => { user.avatar = typeof user.avatar === "string" ? user.avatar : ""; });
db.rooms.forEach((room) => {
  room.type = room.type || (room.public ? "public" : "private");
});
const saveDb = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const migrateUsers = () => {
  const usersByEmail = new Map();
  const duplicateIds = new Set();
  const users = [];
  for (const user of db.users) {
    user.email = normalizeEmail(user.email);
    if (!user.email) {
      users.push(user);
      continue;
    }
    const existing = usersByEmail.get(user.email);
    if (existing) {
      duplicateIds.add(user.id);
      continue;
    }
    usersByEmail.set(user.email, user);
    users.push(user);
  }
  if (!duplicateIds.size) return false;
  const retainedByDuplicate = new Map();
  for (const user of db.users) {
    if (duplicateIds.has(user.id)) retainedByDuplicate.set(user.id, usersByEmail.get(user.email).id);
  }
  db.sessions = db.sessions.filter((session) => {
    if (duplicateIds.has(session.userId)) session.userId = retainedByDuplicate.get(session.userId);
    return users.some((user) => user.id === session.userId);
  });
  db.rooms.forEach((room) => {
    room.members = [...new Set(room.members.map((id) => retainedByDuplicate.get(id) || id))];
  });
  db.messages.forEach((message) => {
    message.senderId = retainedByDuplicate.get(message.senderId) || message.senderId;
  });
  db.users = users;
  return true;
};
if (migrateUsers()) saveDb();
const onlineUsers = new Map();
const getPresence = () => {
  const users = db.users.map((user) => ({
    id: user.id,
    username: user.username,
    avatar: user.avatar || "",
    online: onlineUsers.has(user.id)
  }));
  const online = users.filter((user) => user.online).length;
  return { registered: users.length, online, offline: users.length - online, users };
};
const broadcastPresence = () => io.emit("presence update", getPresence());
const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => ({
  salt,
  hash: crypto.scryptSync(password, salt, 64).toString("hex")
});
const publicUser = (user) => ({ id: user.id, username: user.username, email: user.email, bio: user.bio || "", avatar: user.avatar || "" });
const roomForUser = (room, userId) => {
  if (room.type !== "private") return room;
  const otherUser = db.users.find((item) => item.id !== userId && room.members.includes(item.id));
  return { ...room, name: otherUser ? otherUser.username : room.name, description: otherUser ? `Private conversation with ${otherUser.username}` : room.description };
};
const getToken = (req) => (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
const getUser = (req) => {
  const session = db.sessions.find((item) => item.token === getToken(req));
  return session && db.users.find((user) => user.id === session.userId);
};
const requireUser = (req, res, next) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Please sign in to continue." });
  req.user = user;
  next();
};
const clean = (value, max) => String(value || "").trim().slice(0, max);
const isValidId = (value) => typeof value === "string" && value.length > 0 && value.length <= 100;
const findRoom = (roomId) => db.rooms.find((room) => room.id === roomId);
const canAccessRoom = (room, userId) => Boolean(room && (room.public || room.members.includes(userId)));

app.use(express.json());
app.use(express.static(__dirname));

app.post("/api/auth/signup", (req, res) => {
  const username = clean(req.body.username, 20);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  if (!username || !/^[^\s@]+@gmail\.com$/i.test(email) || password.length < 6) return res.status(400).json({ error: "Enter a valid Gmail address and a password of at least 6 characters." });
  if (db.users.some((user) => normalizeEmail(user.email) === email)) return res.status(409).json({ error: "That Gmail address is already registered. Please log in." });
  if (db.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: "That username is already in use." });
  const user = { id: crypto.randomUUID(), username, email, ...hashPassword(password), bio: "", avatar: "" };
  db.users.push(user);
  saveDb();
  const token = crypto.randomUUID();
  db.sessions.push({ token, userId: user.id });
  saveDb();
  res.status(201).json({ token, user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const user = db.users.find((item) => item.email === email);
  const expectedHash = user ? Buffer.from(user.hash, "hex") : Buffer.alloc(0);
  const suppliedHash = user ? Buffer.from(hashPassword(password, user.salt).hash, "hex") : Buffer.alloc(0);
  const passwordMatches = expectedHash.length === suppliedHash.length && expectedHash.length > 0 && crypto.timingSafeEqual(expectedHash, suppliedHash);
  if (!user || !passwordMatches) return res.status(401).json({ error: "Incorrect email or password." });
  const token = crypto.randomUUID();
  db.sessions.push({ token, userId: user.id });
  saveDb();
  res.json({ token, user: publicUser(user) });
});

app.post("/api/auth/logout", requireUser, (req, res) => {
  const token = getToken(req);
  db.sessions = db.sessions.filter((session) => session.token !== token);
  for (const connectedSocket of io.sockets.sockets.values()) {
    if (connectedSocket.authToken === token) connectedSocket.disconnect(true);
  }
  saveDb();
  res.json({ ok: true });
});

app.get("/api/me", requireUser, (req, res) => res.json({ user: publicUser(req.user) }));
app.get("/api/stats", requireUser, (req, res) => res.json(getPresence()));
app.get("/api/users", requireUser, (req, res) => res.json({ users: getPresence().users }));
app.post("/api/users/:userId/logout", requireUser, (req, res) => {
  if (!isValidId(req.params.userId)) return res.status(400).json({ error: "Invalid user id." });
  const selectedUser = db.users.find((item) => item.id === req.params.userId);
  if (!selectedUser) return res.status(404).json({ error: "User not found." });
  const sessionTokens = new Set(db.sessions.filter((session) => session.userId === selectedUser.id).map((session) => session.token));
  db.sessions = db.sessions.filter((session) => session.userId !== selectedUser.id);
  for (const connectedSocket of io.sockets.sockets.values()) {
    if (connectedSocket.user.id === selectedUser.id || sessionTokens.has(connectedSocket.authToken)) connectedSocket.disconnect(true);
  }
  saveDb();
  broadcastPresence();
  res.json({ ok: true });
});
app.delete("/api/users/:userId", requireUser, (req, res) => {
  if (!isValidId(req.params.userId)) return res.status(400).json({ error: "Invalid user id." });
  const selectedUser = db.users.find((item) => item.id === req.params.userId);
  if (!selectedUser) return res.status(404).json({ error: "User not found." });
  db.users = db.users.filter((item) => item.id !== selectedUser.id);
  db.sessions = db.sessions.filter((session) => session.userId !== selectedUser.id);
  db.rooms.forEach((room) => { room.members = room.members.filter((memberId) => memberId !== selectedUser.id); });
  for (const connectedSocket of io.sockets.sockets.values()) {
    if (connectedSocket.user.id === selectedUser.id) connectedSocket.disconnect(true);
  }
  saveDb();
  broadcastPresence();
  res.json({ ok: true });
});
app.patch("/api/me", requireUser, (req, res) => {
  const username = clean(req.body.username, 20);
  if (username && db.users.some((user) => user.id !== req.user.id && user.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: "That username is already in use." });
  const avatar = String(req.body.avatar || "");
  if (avatar && (!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\r\n]+$/i.test(avatar) || avatar.length > 2_000_000)) return res.status(400).json({ error: "Profile picture must be a supported image smaller than 1.5 MB." });
  req.user.username = username || req.user.username;
  req.user.bio = clean(req.body.bio, 160);
  req.user.avatar = avatar || req.user.avatar || "";
  for (const connectedSocket of io.sockets.sockets.values()) {
    if (connectedSocket.user.id === req.user.id) connectedSocket.user.username = req.user.username;
  }
  saveDb();
  broadcastPresence();
  res.json({ user: publicUser(req.user) });
});

app.get("/api/rooms", requireUser, (req, res) => {
  const query = clean(req.query.search, 60).toLowerCase();
  const rooms = db.rooms
    .filter((room) => room.public || room.members.includes(req.user.id))
    .map((room) => roomForUser(room, req.user.id))
    .filter((room) => !query || room.name.toLowerCase().includes(query));
  res.json({ rooms });
});
app.post("/api/rooms", requireUser, (req, res) => {
  const name = clean(req.body.name, 40);
  if (!name) return res.status(400).json({ error: "Enter a chat name." });
  const room = { id: crypto.randomUUID(), name, description: "Private conversation", public: false, type: "private", members: [req.user.id] };
  db.rooms.push(room);
  saveDb();
  io.emit("rooms update");
  res.status(201).json({ room: roomForUser(room, req.user.id) });
});
app.post("/api/conversations", requireUser, (req, res) => {
  const otherUser = db.users.find((item) => item.id === req.body.userId);
  if (!otherUser || otherUser.id === req.user.id) return res.status(400).json({ error: "Choose another registered user." });
  const members = [req.user.id, otherUser.id].sort();
  let room = db.rooms.find((item) => item.type === "private" && item.members.length === 2 && [...item.members].sort().every((id, index) => id === members[index]));
  if (!room) {
    room = { id: crypto.randomUUID(), name: otherUser.username, description: `Private conversation with ${otherUser.username}`, public: false, type: "private", members };
    db.rooms.push(room);
    saveDb();
    io.emit("rooms update");
  }
  res.status(201).json({ room: roomForUser(room, req.user.id) });
});
app.post("/api/groups", requireUser, (req, res) => {
  const name = clean(req.body.name, 40);
  const requestedMembers = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
  const memberIds = [...new Set([req.user.id, ...requestedMembers])];
  if (!name) return res.status(400).json({ error: "Enter a group name." });
  if (memberIds.length < 2) return res.status(400).json({ error: "Select at least one other user." });
  if (memberIds.some((id) => !db.users.some((item) => item.id === id))) return res.status(400).json({ error: "One or more selected users do not exist." });
  const room = { id: crypto.randomUUID(), name, description: "Group conversation", public: false, type: "group", members: memberIds };
  db.rooms.push(room);
  saveDb();
  io.emit("rooms update");
  res.status(201).json({ room: roomForUser(room, req.user.id) });
});
app.get("/api/rooms/:roomId/messages", requireUser, (req, res) => {
  const room = findRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Chat not found." });
  if (!canAccessRoom(room, req.user.id)) return res.status(403).json({ error: "You do not have access to this chat." });
  res.json({ room: roomForUser(room, req.user.id), messages: db.messages.filter((message) => message.roomId === room.id).slice(-100) });
});

io.use((socket, next) => {
  const authToken = typeof socket.handshake.auth === "string" ? socket.handshake.auth : socket.handshake.auth?.token;
  const session = db.sessions.find((item) => item.token === authToken);
  const user = session && db.users.find((item) => item.id === session.userId);
  if (!user) return next(new Error("Please sign in to join chat."));
  socket.user = user;
  socket.authToken = authToken;
  next();
});
io.on("connection", (socket) => {
  onlineUsers.set(socket.user.id, (onlineUsers.get(socket.user.id) || 0) + 1);
  socket.join("general");
  broadcastPresence();
  socket.on("join room", (roomId, callback) => {
    const room = findRoom(roomId);
    if (!room) return callback?.({ error: "Chat not found." });
    if (!canAccessRoom(room, socket.user.id)) return callback?.({ error: "You do not have access to this chat." });
    for (const joinedRoom of socket.rooms) if (joinedRoom !== socket.id) socket.leave(joinedRoom);
    socket.join(room.id);
    callback?.({ ok: true });
  });
  socket.on("chat message", ({ roomId = "general", message }, callback) => {
    const text = clean(message, 500);
    const room = findRoom(roomId);
    const hasRoomAccess = canAccessRoom(room, socket.user.id);
    if (!text || !hasRoomAccess || !socket.rooms.has(roomId)) return callback?.({ error: "Join this conversation before sending a message." });
    const createdAt = new Date().toISOString();
    const payload = { id: crypto.randomUUID(), roomId, username: socket.user.username, senderId: socket.user.id, message: text, time: new Date(createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), createdAt };
    db.messages.push(payload);
    saveDb();
    io.to(roomId).emit("chat message", payload);
    callback?.({ ok: true });
  });
  socket.on("disconnect", () => {
    const connections = onlineUsers.get(socket.user.id) || 1;
    if (connections === 1) onlineUsers.delete(socket.user.id);
    else onlineUsers.set(socket.user.id, connections - 1);
    broadcastPresence();
  });
});

server.listen(PORT, "0.0.0.0", () => console.log(`Legacy server listening on port ${PORT}`));
