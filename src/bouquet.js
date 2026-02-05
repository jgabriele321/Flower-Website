export const DEFAULT_COUNTS = {
  focal: 3,
  secondary: 4,
  greenery: 5,
};

const BUCKETS = ["focal", "secondary", "greenery"];

const randomChoice = (arr) =>
  arr.length === 0 ? null : arr[Math.floor(Math.random() * arr.length)];

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

function sampleWithReplacement(arr, count) {
  if (!arr || arr.length === 0 || count <= 0) return [];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(randomChoice(arr));
  }
  return out;
}

export function pickPalette(manifest, lastPalette) {
  const keys = Object.keys(manifest?.palettes || {});
  if (keys.length === 0) return null;
  if (lastPalette && keys.includes(lastPalette)) return lastPalette;
  return randomChoice(keys);
}

export function prepareBouquet(manifest, options = {}) {
  const paletteName = options.palette || pickPalette(manifest, options.lastPalette);
  const paletteBuckets =
    (paletteName && manifest?.palettes?.[paletteName]) || {
      focal: [],
      secondary: [],
      greenery: [],
    };
  const counts = { ...DEFAULT_COUNTS, ...(options.counts || {}) };

  const flowers = BUCKETS.flatMap((bucket) =>
    sampleWithReplacement(paletteBuckets[bucket] || [], counts[bucket]).map(
      (src) => ({ src, bucket })
    )
  );

  return {
    paletteName,
    flowers,
    vaseSrc: randomChoice(manifest?.vases || []) || "",
    backgroundSrc: randomChoice(manifest?.backgrounds || []) || "",
  };
}

function randomPointInEllipse(cx, cy, rx, ry) {
  const t = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random());
  return {
    x: cx + r * rx * Math.cos(t),
    y: cy + r * ry * Math.sin(t),
  };
}

function rotationForBucket(bucket) {
  const ranges = {
    focal: 12,
    secondary: 18,
    greenery: 28,
  };
  const r = ranges[bucket] || 10;
  return (Math.random() * 2 - 1) * r;
}

// Estimate flower radius based on bucket and scale
// Using typical flower image dimensions as reference (approx 800x800px)
function estimateFlowerRadius(bucket, scale) {
  const baseRadius = {
    focal: 400,      // Larger focal flowers
    secondary: 350,  // Medium secondary flowers
    greenery: 300,   // Smaller greenery
  };
  return (baseRadius[bucket] || 350) * scale;
}

// Check if two flowers collide based on their positions and estimated sizes
function checkCollision(flower1, flower2) {
  const radius1 = estimateFlowerRadius(flower1.bucket, flower1.scale);
  const radius2 = estimateFlowerRadius(flower2.bucket, flower2.scale);
  const minDistance = radius1 + radius2;
  
  const dx = flower1.x - flower2.x;
  const dy = flower1.y - flower2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Add a small buffer (10% of average radius) to ensure spacing
  const buffer = (radius1 + radius2) * 0.1;
  return distance < (minDistance + buffer);
}

export function layoutBouquet(flowers, stageSize) {
  const { width, height } = stageSize;
  const aspectRatio = height / width;
  const isTallMobile = aspectRatio > 1.4;

  // Adjust center and scale for tall mobile screens
  const cx = width * 0.5;
  const cy = isTallMobile ? height * 0.38 : height * 0.46;

  // More aggressive scale reduction on tall screens
  let baseScale = clamp(width / 1400, 0.38, 0.78);
  if (isTallMobile) {
    baseScale *= 0.75;
  }

  // Shrink ellipse radii on tall screens
  const radiusMult = isTallMobile ? 0.8 : 1.0;
  const radii = {
    focal: { rx: width * 0.10 * radiusMult, ry: height * 0.05 * radiusMult, yOffset: -6 },
    secondary: { rx: width * 0.14 * radiusMult, ry: height * 0.07 * radiusMult, yOffset: 6 },
    greenery: { rx: width * 0.20 * radiusMult, ry: height * 0.10 * radiusMult, yOffset: 14 },
  };

  const scaleForBucket = {
    focal: baseScale * 1.0,
    secondary: baseScale * 0.9,
    greenery: baseScale * 0.78,
  };

  const MAX_RETRIES = 10;
  const placedFlowers = [];

  return flowers.map((flower, idx) => {
    const config = radii[flower.bucket] || radii.secondary;
    const scale = scaleForBucket[flower.bucket] ?? baseScale;
    const rotation = rotationForBucket(flower.bucket);
    
    let flowerPos = null;
    let attempts = 0;
    let hasCollision = true;

    // Try to find a position without collision
    while (hasCollision && attempts < MAX_RETRIES) {
      const pos = randomPointInEllipse(cx, cy + config.yOffset, config.rx, config.ry);
      const jitterY = (Math.random() * 2 - 1) * 8;
      
      const candidateFlower = {
        ...flower,
        x: pos.x,
        y: pos.y + jitterY,
        rotation,
        scale,
        z: idx,
      };

      // Check collision with already placed flowers
      hasCollision = placedFlowers.some((placed) => 
        checkCollision(candidateFlower, placed)
      );

      if (!hasCollision) {
        flowerPos = candidateFlower;
      }
      attempts++;
    }

    // If we couldn't find a non-colliding position after retries, use the last attempt
    if (!flowerPos) {
      const pos = randomPointInEllipse(cx, cy + config.yOffset, config.rx, config.ry);
      const jitterY = (Math.random() * 2 - 1) * 8;
      flowerPos = {
        ...flower,
        x: pos.x,
        y: pos.y + jitterY,
        rotation,
        scale,
        z: idx,
      };
    }

    placedFlowers.push(flowerPos);
    return flowerPos;
  });
}
