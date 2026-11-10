const http = require("http");
const mongoose = require("mongoose");
const env = require("./config/env");
const createApp = require("./app");
const attachSocket = require("./socket");
const Conversation = require("./models/Conversation");

const start = async () => {
  await mongoose.connect(env.mongoUri);
  await Conversation.updateOne({ type: "public", name: "General Chat" }, { $setOnInsert: { type: "public", name: "General Chat", description: "Say hello to everyone in the room.", members: [] } }, { upsert: true });
  const app = createApp(env.frontendOrigin);
  const server = http.createServer(app);
  const io = attachSocket(server, env.frontendOrigin);
  app.set("io", io);
  server.listen(env.port, "0.0.0.0", () => console.log(`Backend running on port ${env.port}`));
};

start().catch((error) => {
  console.error("Backend startup failed:", error.message);
  if (error.code === 8000 || /bad auth|authentication failed/i.test(error.message)) {
    console.error("Check MONGODB_URI: use your Atlas database user credentials, verify the username and password, percent-encode special characters, and redeploy.");
  }
  process.exitCode = 1;
});
