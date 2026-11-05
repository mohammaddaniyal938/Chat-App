const { Server } = require("socket.io");
const Session = require("./models/Session");
const Conversation = require("./models/Conversation");
const { canAccess } = require("./services/conversation");
const { create } = require("./services/message");
const { presence } = require("./controllers/userController");
const { setOnline, setOffline } = require("./services/presence");

const attachSocket = (server, origin) => {
  const allowedOrigins = String(origin).split(",").map((value) => value.trim()).filter(Boolean);
  const io = new Server(server, {
    cors: {
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || allowedOrigins.includes("*") || allowedOrigins.includes(requestOrigin)) return callback(null, true);
        return callback(new Error("Origin is not allowed by the server CORS policy."));
      },
      credentials: true
    }
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const session = await Session.findOne({ token }).populate("user");
      if (!session || session.expiresAt <= new Date() || !session.user) return next(new Error("Please sign in to join chat."));
      socket.user = session.user;
      socket.authToken = token;
      next();
    } catch (error) {
      next(error);
    }
  });
  io.on("connection", (socket) => {
    setOnline(socket.user._id);
    socket.join("public");
    presence().then((data) => io.emit("presence update", data)).catch(console.error);
    socket.on("join room", async (roomId, callback) => {
      const room = await Conversation.findById(roomId);
      if (!canAccess(room, socket.user._id)) return callback?.({ error: "You do not have access to this chat." });
      for (const joined of socket.rooms) if (joined !== socket.id && joined !== "public") socket.leave(joined);
      socket.join(room.id);
      callback?.({ ok: true });
    });
    socket.on("chat message", async (payload, callback) => {
      try {
        const room = await Conversation.findById(payload?.roomId);
        const text = String(payload?.message || "").trim().slice(0, 500);
        if (!text || !canAccess(room, socket.user._id) || !socket.rooms.has(room?.id)) return callback?.({ error: "Join this conversation before sending a message." });
        const message = await create(room.id, socket.user, text);
        io.to(room.id).emit("chat message", message);
        callback?.({ ok: true });
      } catch (error) {
        callback?.({ error: "Message could not be sent." });
      }
    });
    socket.on("disconnect", () => {
      setOffline(socket.user._id);
      presence().then((data) => io.emit("presence update", data)).catch(console.error);
    });
  });
  return io;
};

module.exports = attachSocket;
