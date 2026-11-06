const mongoose = require("mongoose");
const env = require("../backend/config/env");
const createApp = require("../backend/app");
const Conversation = require("../backend/models/Conversation");

let appPromise;

const connect = async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(env.mongoUri);
  }
  await Conversation.updateOne(
    { type: "public", name: "General Chat" },
    {
      $setOnInsert: {
        type: "public",
        name: "General Chat",
        description: "Say hello to everyone in the room.",
        members: []
      }
    },
    { upsert: true }
  );
};

const getApp = () => {
  if (!appPromise) {
    appPromise = connect()
      .then(() => createApp(env.frontendOrigin))
      .catch((error) => {
        appPromise = null;
        throw error;
      });
  }
  return appPromise;
};

module.exports = async (req, res) => {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error("API startup failed:", error.message);
    return res.status(503).json({ error: "The API is temporarily unavailable." });
  }
};
