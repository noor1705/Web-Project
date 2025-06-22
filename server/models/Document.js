// server/models/Document.js
const mongoose = require("mongoose");

const passkeySchema = new mongoose.Schema({
  key: String,
  isUsed: { type: Boolean, default: false },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
});

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  university: { type: String }, // will be auto-filled from user
  semester: { type: String, enum: ["Fall", "Spring", "Summer"], required: true },
  academicYear: { type: Number, required: true }, // e.g., 2024
  courseName: { type: String, required: true },
  instructorName: { type: String },
  accessType: { type: String, enum: ["free", "paid"], default: "free" },
  fileUrl: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  upvotes: { type: Number, default: 0 },
  tags:[String],
  price:{ type:Number ,default:0},
  passkeys: [passkeySchema], // Only used if accessType === "paid"
});

module.exports = mongoose.model("Document", documentSchema);
