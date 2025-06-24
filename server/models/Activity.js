const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: [ "download", "publish", "upvote"],
    required: true
  },
  contentRef: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "contentType"
  },
  contentType: {
    type: String,
    enum: ["Document", "Discussion", "Comment"]
  },
  link: { type: String }, // Optional URL
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Activity", activitySchema);
