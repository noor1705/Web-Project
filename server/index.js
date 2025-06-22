// index.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Accept JSON data

//routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
const userRoutes = require("./routes/user");
app.use("/api/user", userRoutes);
const documentRoutes = require("./routes/documents");
app.use("/api/document", documentRoutes);
const exploreRoutes = require("./routes/explore");
app.use("/api/explore", exploreRoutes);


// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log("MongoDB connected");
  app.listen(process.env.PORT || 5000, () => {
    console.log(` Server is running on port ${process.env.PORT || 5000}`);
  });
})
.catch((err) => {
  console.error("MongoDB connection error:", err.message);
});
