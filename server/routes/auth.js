// server/routes/auth.js

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ✅ Correct path to the model
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const sendEmail = require("./sendEmail"); // Will use this to send verification emails
function extractUniversityFromEmail(email) {
  const domain = email.split("@")[1];
  if (!domain) return "";

  const base = domain.split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1); // Capitalize
}

// 📌 Signup Route
router.post("/signup", async (req, res) => {
  const { name, email, password, department, program } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "Email already in use" });

    const university = extractUniversityFromEmail(email); // auto-filled here

    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });

    const user = new User({
      name,
      email,
      password: hashedPassword,
      university,
      verificationToken
    });

    await user.save();


await user.save();

// Create wallet after successful user creation
const newWallet = new Wallet({
  userId: user._id,
  balance: 200,
});
await newWallet.save();
    const verifyUrl = `${process.env.FRONTEND_URL}/verify?token=${verificationToken}`;
    await sendEmail(email, "Verify your Doc-Spot account", `
     <p>Hello ${name},</p>
     <p>Click the link below to verify your email:</p>
     <a href="${verifyUrl}" style="padding: 10px 20px; background: #4caf50; color: white; text-decoration: none;">Verify Email</a>
     `);

    console.log("Verify URL:", verifyUrl);
    res.status(201).json({ msg: "Signup successful. Please check your email to verify your account." });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ msg: "Internal server error" });
  }
});
// 🔐 Middleware to extract user from token
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ msg: "No token provided" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Invalid token" });
  }
}
// Verifu Routes

router.get("/verify", async (req, res) => {
  const token = req.query.token;

  if (!token) return res.status(400).send("Missing verification token.");

  try {
    // Decode the token using JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by email in the token
    const user = await User.findOne({ email: decoded.email });

    if (!user) return res.status(404).send("User not found.");
    if (user.isVerified) return res.send("User already verified.");

    // Update user status
    user.isVerified = true;
    user.verificationToken = undefined; // optional: remove token
    await user.save();

    res.send("✅ Email verified successfully. You can now log in.");
  } catch (err) {
    console.error("Verification error:", err.message);
    res.status(400).send("Invalid or expired token.");
  }
});


// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "❌ User not found." });

    // 2. Check if email is verified
    if (!user.isVerified) return res.status(401).json({ msg: "⚠️ Please verify your email first." });

    // 3. Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ msg: "❌ Invalid credentials." });

    // 4. Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    // 5. Return token and user info
    res.json({
      msg: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        university: user.university,
        department: user.department,
        program: user.program
      }
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ msg: "Server error during login." });
  }
});
//Resend Route
router.post("/resend-verification", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required." });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.isVerified) return res.json({ message: "User is already verified." });

    // Create new token
    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: "1h" });
    user.verificationToken = token;
    await user.save();

    // Email content
    const verificationLink = `http://localhost:3000/verify?token=${token}&email=${email}`;

    await sendEmail(
      user.email,
      "Email Verification - Doc Spot",
      `<h3>Hello ${user.username || "User"},</h3>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${verificationLink}">Verify Email</a>
      <br/><br/>
      <p>If you did not request this, please ignore.</p>`
    );

    res.json({ message: "New verification email sent." });
  } catch (err) {
    console.error("Resend verification error:", err.message);
    res.status(500).json({ message: "Failed to resend verification email." });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("/me error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
