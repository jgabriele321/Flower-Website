import Konva from "konva";
import "./style.css";
import { layoutBouquet, prepareBouquet } from "./bouquet";

const container = document.getElementById("canvas-container");
const loadingEl = document.getElementById("loading");
const newBtn = document.getElementById("new-bouquet");
const arrangeBtn = document.getElementById("arrange-toggle");
const captureBtn = document.getElementById("capture-btn");
const galleryBtn = document.getElementById("gallery-btn");
const toast = document.getElementById("toast");

let stage;
let backgroundLayer;
let bouquetLayer;
let manifest;
let currentFlowers = [];
let vaseNode = null;
let backgroundNode = null;
let arrangeMode = true;
let lastPalette = null;
let isBuilding = false;

const setLoading = (show) => {
  loadingEl.style.display = show ? "grid" : "none";
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

async function loadManifest() {
  const res = await fetch("/flowers/manifest.json", { cache: "no-cache" });
  if (!res.ok) {
    throw new Error("Unable to load manifest.json");
  }
  manifest = await res.json();
}

function setupStage() {
  stage = new Konva.Stage({
    container,
    width: container.clientWidth,
    height: container.clientHeight,
  });
  backgroundLayer = new Konva.Layer();
  bouquetLayer = new Konva.Layer();
  stage.add(backgroundLayer);
  stage.add(bouquetLayer);
  window.addEventListener("resize", handleResize, { passive: true });
}

function buildVase(image, stageSize) {
  const aspectRatio = stageSize.height / stageSize.width;
  const isTallMobile = aspectRatio > 1.4;

  // Smaller vase on tall mobile screens
  const heightRatio = isTallMobile ? 0.36 : 0.46;
  const targetHeight = stageSize.height * heightRatio;
  const scale = targetHeight / image.height;
  const width = image.width * scale;
  const x = stageSize.width * 0.5 - width * 0.5;

  // Adjust vertical position on tall screens
  const yOffset = isTallMobile ? 0.88 : 0.92;
  const y = stageSize.height - targetHeight * yOffset;

  vaseNode = new Konva.Image({
    image,
    x,
    y,
    width,
    height: targetHeight,
    listening: true, // Enable listening so vase can receive click events
    draggable: false, // Explicitly set to false to prevent dragging
  });
  
  // Add click handler to bring vase to front when clicked
  vaseNode.on("mousedown touchstart", () => {
    bringToFront(vaseNode);
  });
  
  bouquetLayer.add(vaseNode);
}

function buildBackground(image, stageSize) {
  backgroundNode = new Konva.Image({
    image,
    x: 0,
    y: 0,
    width: stageSize.width,
    height: stageSize.height,
    listening: false,
  });
  backgroundLayer.add(backgroundNode);
}

function wireInteractivity(node) {
  node.on("mouseover touchstart", () => {
    if (arrangeMode) document.body.style.cursor = "grab";
  });
  node.on("mouseout", () => {
    document.body.style.cursor = "default";
  });
  node.on("dragstart", () => {
    document.body.style.cursor = "grabbing";
  });
  node.on("dragend", () => {
    document.body.style.cursor = arrangeMode ? "grab" : "default";
  });
  node.on("mousedown touchstart", () => {
    bringToFront(node);
  });
}

function bringToFront(node) {
  node.moveToTop();
  // Don't automatically move vase to top - flowers can be in front of vase
  bouquetLayer.draw();
}

async function buildBouquet(options = {}) {
  if (isBuilding) return;
  isBuilding = true;
  setLoading(true);
  try {
    currentFlowers = [];
    bouquetLayer.destroyChildren();
    backgroundLayer.destroyChildren();

    const stageSize = {
      width: container.clientWidth,
      height: container.clientHeight,
    };
    stage.size(stageSize);

    const plan = prepareBouquet(manifest, {
      palette: options.palette,
      lastPalette,
    });
    lastPalette = plan.paletteName;

    const layout = layoutBouquet(plan.flowers, stageSize);
    const sources = [
      ...plan.flowers.map((f) => f.src),
      plan.vaseSrc,
      plan.backgroundSrc,
    ].filter(Boolean);

    const imageMap = {};
    await Promise.all(
      sources.map((src) =>
        loadImage(src).then((img) => {
          imageMap[src] = img;
        })
      )
    );

    if (plan.backgroundSrc && imageMap[plan.backgroundSrc]) {
      buildBackground(imageMap[plan.backgroundSrc], stageSize);
    } else {
      const fallbackBg = new Konva.Rect({
        x: 0,
        y: 0,
        width: stageSize.width,
        height: stageSize.height,
        fill: "#f7f4ee",
        listening: false,
      });
      backgroundLayer.add(fallbackBg);
    }

    layout.forEach((flower) => {
      const img = imageMap[flower.src];
      if (!img) return;
      const node = new Konva.Image({
        image: img,
        x: flower.x,
        y: flower.y,
        offsetX: img.width / 2,
        offsetY: img.height * 0.85, // Pivot from bottom of flower so stems go into vase
        scaleX: flower.scale,
        scaleY: flower.scale,
        rotation: flower.rotation,
        draggable: arrangeMode,
        shadowColor: "rgba(0,0,0,0.18)",
        shadowBlur: 12,
        shadowOpacity: 0.25,
      });
      // Enable pixel-perfect hit detection that ignores transparent areas
      node.cache();
      node.drawHitFromCache();
      wireInteractivity(node);
      currentFlowers.push(node);
      bouquetLayer.add(node);
    });

    if (plan.vaseSrc && imageMap[plan.vaseSrc]) {
      buildVase(imageMap[plan.vaseSrc], stageSize);
    }

    backgroundLayer.draw();
    bouquetLayer.draw();
  } finally {
    setLoading(false);
    isBuilding = false;
  }
}

function handleResize() {
  buildBouquet({ palette: lastPalette });
}

function toggleArrange() {
  arrangeMode = !arrangeMode;
  currentFlowers.forEach((node) => node.draggable(arrangeMode));
  arrangeBtn.textContent = `Arrange Mode: ${arrangeMode ? "On" : "Off"}`;
  arrangeBtn.setAttribute("aria-pressed", String(arrangeMode));
  document.body.style.cursor = "default";
}

async function init() {
  try {
    await loadManifest();
    setupStage();
    await buildBouquet();
  } catch (err) {
    loadingEl.textContent = "Failed to load assets. Check manifest.";
    console.error(err);
  }
}

newBtn.addEventListener("click", async () => {
  await buildBouquet();
});

arrangeBtn.addEventListener("click", () => {
  toggleArrange();
});

// Info popup
const infoBtn = document.getElementById("info-btn");
const infoOverlay = document.getElementById("info-overlay");
const infoClose = document.getElementById("info-close");

infoBtn.addEventListener("click", () => {
  infoOverlay.classList.remove("hidden");
});

infoClose.addEventListener("click", () => {
  infoOverlay.classList.add("hidden");
});

infoOverlay.addEventListener("click", (e) => {
  if (e.target === infoOverlay) {
    infoOverlay.classList.add("hidden");
  }
});

// Toast notification
function showToast(message = "Saved!") {
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2000);
}

// Capture and upload to gallery
async function captureToGallery() {
  if (!stage) return;

  captureBtn.disabled = true;
  captureBtn.textContent = "Saving...";

  try {
    // Capture canvas as JPEG
    const dataUrl = stage.toDataURL({
      mimeType: "image/jpeg",
      quality: 0.9,
    });

    // Upload to server
    const res = await fetch("/api/gallery/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl }),
    });

    if (!res.ok) throw new Error("Upload failed");

    showToast("Saved!");
  } catch (err) {
    console.error("Capture error:", err);
    showToast("Failed to save");
  } finally {
    captureBtn.disabled = false;
    captureBtn.textContent = "Save";
  }
}

captureBtn.addEventListener("click", captureToGallery);

// Gallery state
let galleryImages = [];
let galleryIndex = 0;

// Load gallery images
async function loadGalleryImages() {
  try {
    const res = await fetch("/api/gallery/list");
    if (!res.ok) throw new Error("Failed to load gallery");
    const data = await res.json();
    galleryImages = data.images || [];
    return galleryImages;
  } catch (err) {
    console.error("Gallery load error:", err);
    return [];
  }
}

// Open gallery
async function openGallery() {
  const overlay = document.getElementById("gallery-overlay");
  const counter = document.getElementById("gallery-counter");
  const img = document.getElementById("gallery-image");
  const emptyMsg = document.getElementById("gallery-empty");

  overlay.classList.remove("hidden");

  await loadGalleryImages();

  if (galleryImages.length === 0) {
    img.style.display = "none";
    emptyMsg.style.display = "block";
    counter.textContent = "No photos yet";
  } else {
    galleryIndex = 0;
    img.style.display = "block";
    emptyMsg.style.display = "none";
    showGalleryImage();
  }
}

// Show current gallery image
function showGalleryImage() {
  const img = document.getElementById("gallery-image");
  const counter = document.getElementById("gallery-counter");

  if (galleryImages.length === 0) return;

  const current = galleryImages[galleryIndex];
  img.src = current.url;
  counter.textContent = `${galleryIndex + 1} of ${galleryImages.length}`;
}

// Navigate gallery
function galleryPrev() {
  if (galleryImages.length === 0) return;
  galleryIndex = (galleryIndex - 1 + galleryImages.length) % galleryImages.length;
  showGalleryImage();
}

function galleryNext() {
  if (galleryImages.length === 0) return;
  galleryIndex = (galleryIndex + 1) % galleryImages.length;
  showGalleryImage();
}

// Close gallery
function closeGallery() {
  document.getElementById("gallery-overlay").classList.add("hidden");
}

galleryBtn.addEventListener("click", openGallery);

// Gallery navigation event listeners (set up after DOM ready)
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("gallery-close")?.addEventListener("click", closeGallery);
  document.getElementById("gallery-prev")?.addEventListener("click", galleryPrev);
  document.getElementById("gallery-next")?.addEventListener("click", galleryNext);

  document.getElementById("gallery-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "gallery-overlay") closeGallery();
  });

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    const overlay = document.getElementById("gallery-overlay");
    if (overlay?.classList.contains("hidden")) return;

    if (e.key === "ArrowLeft") galleryPrev();
    else if (e.key === "ArrowRight") galleryNext();
    else if (e.key === "Escape") closeGallery();
  });
});

init();
