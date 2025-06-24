const express = require("express");
const router = express.Router();
const upload = require("../utils/multer");
const cloudinary = require("../utils/cloudinary");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const Document = require("../models/Document");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const DownloadedDoc = require("../models/DownloadedDoc");
const Activity = require("../models/Activity");

// 🔐 Middleware: Authenticate JWT
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ msg: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id || decoded._id,
    };
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Invalid token" });
  }
}


// 🏫 Extract university name from email domain
function extractUniversity(email) {
  const match = email.match(/@||.([\w-]+)\./);
  return match ? match[1] : "unknown";
}

// 🔐 Generate passkeys for paid documents
function generatePasskeys(count = 10) {
  const keys = [];
  for (let i = 0; i < count; i++) {
    const key = Math.random().toString(36).substr(2, 10);
    keys.push({ key });
  }
  return keys;
}

// 📤 Upload Route
router.post("/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    const {
      title,
      description,
      semester,
      academicYear,
      courseName,
      instructorName,
      accessType,
      price,
    } = req.body;

    // Parse tags array
    let tags = [];
    if (req.body.tags) {
      try {
        tags = JSON.parse(req.body.tags);
        if (!Array.isArray(tags)) throw new Error("Tags must be an array");
      } catch (err) {
        return res.status(400).json({ msg: "Invalid tags format" });
      }
    }

    // Validate price for paid access
    let documentPrice = 0;
    if (accessType === "paid") {
      documentPrice = parseFloat(price);
      if (isNaN(documentPrice) || documentPrice < 0) {
        return res.status(400).json({ msg: "Invalid price for paid document" });
      }
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const university = extractUniversity(user.email);
    const passkeys = accessType === "paid" ? generatePasskeys() : [];
    const filePath = req.file.path;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "doc-spot",
      resource_type: "raw", // PDF, DOC support
      public_id: req.file.originalname.split(".")[0],
    });

    // Clean up local file
    fs.unlink(filePath, (err) => {
      if (err) console.error("❌ Failed to delete local file:", err);
      else console.log("🧹 Local file deleted:", filePath);
    });

    // Save document in DB
    const newDoc = new Document({
      title,
      description,
      semester,
      academicYear,
      university,
      courseName,
      instructorName,
      accessType,
      price: accessType === "paid" ? documentPrice : 0,
      tags,
      fileUrl: result.secure_url,
      uploadedBy: user._id,
      passkeys,
    });

    await newDoc.save();

    res.status(201).json({
      msg: "📄 Document uploaded successfully",
      doc: newDoc,
    });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ msg: "❌ Upload failed" });
  }
});

// 📄 Get documents uploaded by current user
router.get("/uploaded", authenticate, async (req, res) => {
  try {
    const docs = await Document.find({ uploadedBy: req.user.id }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    console.error("❌ Fetch uploaded error:", err);
    res.status(500).json({ msg: "❌ Failed to fetch uploaded documents" });
  }
});


router.get("/downloaded", authenticate, async (req, res) => {
  try {
    // Example: You must adapt this if your download logic is elsewhere
    const user = await User.findById(req.user.id).populate("downloadedDocs.documentId");
    const downloaded = user.downloadedDocs.map(d => ({
      ...d.documentId._doc,
      usedKey: d.usedKey,
    }));
    res.json(downloaded);
  } catch (err) {
    console.error("❌ Fetch downloaded docs error:", err);
    res.status(500).json({ msg: "Failed to fetch downloaded documents" });
  }
});

// 📄 Get recent documents (public)

router.post("/buy/:id", authenticate, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.accessType !== "paid")
      return res.status(404).json({ message: "Paid doc not found" });

    const buyerWallet = await Wallet.findOne({ userId: req.user.id });
    const sellerWallet = await Wallet.findOne({ userId: doc.uploadedBy });

    if (!buyerWallet || buyerWallet.balance < doc.price)
      return res.status(400).json({ message: "Insufficient balance" });

    // 💸 Deduct from buyer
    buyerWallet.balance -= doc.price;
    buyerWallet.transactions.push({
      type: "debit",
      amount: doc.price,
      description: `Purchase: ${doc.title}`,
      documentId: doc._id,
    });
    await buyerWallet.save();

    sellerWallet.balance += doc.price;
    sellerWallet.transactions.push({
      type: "credit",
      amount: doc.price,
      description: `Sale: ${doc.title}`,
      documentId: doc._id,
    });
    await sellerWallet.save();

    // 🧾 Log downloaded doc
    await DownloadedDoc.create({
      userId: req.user.id,
      documentId: doc._id,
    });

    // 🧠 Log activity
    await Activity.create({
      user: req.user.id,
      type: "download",
      contentRef: doc._id,
      contentType: "Document",
    });

    // ✅ Ensure file URL exists
    if (!doc.fileUrl)
      return res.status(500).json({ message: "No file URL available" });

    res.json({ fileUrl: doc.fileUrl });

  } catch (err) {
    console.error(" Buy error:", err);
    res.status(500).json({ message: "Purchase failed" });
  }
});


router.post("/download/:id", authenticate, async (req, res) => {
  
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (doc.accessType !== "free")
      return res.status(403).json({ message: "Not a free document" });

    const userId = req.user.id;

    await DownloadedDoc.create({
      userId,
      documentId: doc._id,
    });

    await Activity.create({
      user: userId,
      type: "download",
      contentRef: doc._id,
      contentType: "Document",
    });

    if (!doc.fileUrl)
      return res.status(500).json({ message: "No file URL available" });

    res.json({ fileUrl: doc.fileUrl });
  } catch (err) {
    console.error("Free download error:", err.message);
    res.status(500).json({ message: "Free download failed" });
  }
});


router.get("/all", authenticate, async (req, res) => {
  try {
    const documents = await Document.find({
      uploadedBy: { $ne: req.user.id }, // Exclude user's own docs
    }).populate("uploadedBy", "name profilePic");

    const docsWithPublisher = documents.map((doc) => ({
      ...doc._doc,
      publisher: doc.uploadedBy.name,
      profilePic: doc.uploadedBy.profilePic,
      publisherId: doc.uploadedBy._id,
    }));

    res.json(docsWithPublisher);
  } catch (err) {
    console.error("Error fetching documents:", err);
    res.status(500).json({ message: "Server error while fetching documents" });
  }
});
router.post("/upvote/:id", authenticate, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    doc.upvotes += 1;
    await doc.save();

    res.json({ message: "Upvote successful", upvotes: doc.upvotes });
  } catch (err) {
    console.error("Upvote error:", err.message);
    res.status(500).json({ message: "Upvote failed" });
  }
});

module.exports = router;
