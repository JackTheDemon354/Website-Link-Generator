const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

/**
 * Store expiry timestamps as UNIX ms epoch.
 * Structure: { filename: expiryTimestamp }
 */
const fileExpiries = {};

// Upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
  const expirySeconds = parseInt(req.body.expiry) || 0;
  const filename = req.file.filename;

  if (expirySeconds > 0) {
    const expiryTime = Date.now() + expirySeconds * 1000;
    fileExpiries[filename] = expiryTime;
  }

  res.json({ url: `/files/${filename}` });
});

// Serve uploaded files with expiry check
app.get("/files/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);

  // Check if expired
  if (fileExpiries[filename] && Date.now() > fileExpiries[filename]) {
    // Delete file and expiry record
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    delete fileExpiries[filename];

    // Send your custom 404 terminal page
    return res.sendFile(path.join(__dirname, "public", "404.html"));
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
  }

  res.sendFile(filePath);
});

// Clean expired files every minute (optional safety)
setInterval(() => {
  const now = Date.now();
  for (const [file, expiry] of Object.entries(fileExpiries)) {
    if (expiry < now) {
      const filePath = path.join(uploadsDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      delete fileExpiries[file];
    }
  }
}, 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
