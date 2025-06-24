// routes/explore.js
const express = require("express");
const router = express.Router();
const Document = require("../models/Document");
const jwt = require("jsonwebtoken");


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
router.get("/search", authenticate, async (req, res) => {
  const query = req.query.query?.trim().toLowerCase();
  if (!query) return res.status(400).json({ message: "Query is required" });

  try {
    const documents = await Document.find({
      uploadedBy: { $ne: req.user.id },
      $or: [
        { title: { $regex: query, $options: "i" } },
        { tags: { $in: [query] } },
      ],
    }).populate("uploadedBy", "name profilePic");

    const result = documents.map((doc) => ({
      ...doc._doc,
      publisher: doc.uploadedBy.name,
      profilePic: doc.uploadedBy.profilePic,
      publisherId: doc.uploadedBy._id,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Search failed" });
  }
});

module.exports = router;
