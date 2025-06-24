// models/DownloadedDoc.js
const mongoose = require("mongoose");

const downloadedDocSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Document",
    required: true,
  },
  usedKey: {
    type: String, // Only applies to paid docs
    default: null,
  },
  downloadedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("DownloadedDoc", downloadedDocSchema);
