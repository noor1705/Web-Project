const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(edu|pk|com)$/
  },
  password: { type: String, required: true },
  university: { type: String, required: false },
  department: { type: String, required: false },
  program: { type: String },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  createdAt: { type: Date, default: Date.now },
  profilePic: { type: String }, // URL to Cloudinary or storage
  interests: [String],
  linkedin: { type: String },
  github: { type: String },

});

module.exports = mongoose.model("User", userSchema);
