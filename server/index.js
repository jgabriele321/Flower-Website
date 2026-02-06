const express = require("express");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const app = express();
const PORT = process.env.PORT || 3086;

// Gallery directory - images stored here
const GALLERY_DIR = process.env.GALLERY_DIR || path.join(__dirname, "../gallery");

// Ensure gallery directory exists
if (!fs.existsSync(GALLERY_DIR)) {
  fs.mkdirSync(GALLERY_DIR, { recursive: true });
}

// Parse JSON bodies (for base64 image data)
app.use(express.json({ limit: "10mb" }));

// CORS headers for local development
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// POST /api/gallery/upload - Save a new gallery image
app.post("/api/gallery/upload", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "No image data provided" });
    }

    // Extract base64 data (remove data:image/...;base64, prefix if present)
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Generate filename with timestamp
    const filename = `${Date.now()}.jpg`;
    const filepath = path.join(GALLERY_DIR, filename);

    // Resize to 1600px width and convert to JPEG
    await sharp(imageBuffer)
      .resize(1600, null, { withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toFile(filepath);

    console.log(`Saved gallery image: ${filename}`);

    res.json({
      success: true,
      filename,
      url: `/gallery/${filename}`,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to save image" });
  }
});

// GET /api/gallery/list - Get all gallery images
app.get("/api/gallery/list", (req, res) => {
  try {
    const files = fs.readdirSync(GALLERY_DIR);

    // Filter for image files and sort by newest first
    const images = files
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map((f) => ({
        filename: f,
        url: `/gallery/${f}`,
        timestamp: parseInt(f.split(".")[0]) || 0,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json({ images });
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ error: "Failed to list images" });
  }
});

// Health check
app.get("/api/gallery/health", (req, res) => {
  res.json({ status: "ok", galleryDir: GALLERY_DIR });
});

// Serve gallery images (for local development)
app.use("/gallery", express.static(GALLERY_DIR));

app.listen(PORT, () => {
  console.log(`Gallery server running on port ${PORT}`);
  console.log(`Gallery directory: ${GALLERY_DIR}`);
});
