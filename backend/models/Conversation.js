const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  type: { type: String, enum: ["public", "private", "group"], required: true },
  name: { type: String, trim: true, maxlength: 40, default: "" },
  description: { type: String, maxlength: 160, default: "" },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

conversationSchema.index({ type: 1, members: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);
