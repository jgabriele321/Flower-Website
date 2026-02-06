export const DEFAULT_COUNTS = {
  focal: 3,
  secondary: 5,
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

export function pickPalette(manifest) {
  const keys = Object.keys(manifest?.palettes || {});
  if (keys.length === 0) return null;
  return randomChoice(keys);
}

export function prepareBouquet(manifest, options = {}) {
  const paletteName = options.palette || pickPalette(manifest);
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

function rotationForBucket(bucket, positionAngle) {
  // More aggressive rotation to make bouquet "bloom" outward
  // Flowers rotate away from center based on their position
  const baseRotation = {
    focal: 25,
    secondary: 40,
    greenery: 55,
  };
  const r = baseRotation[bucket] || 30;
  
  // Add outward rotation based on position angle (flowers lean outward from center)
  const outwardLean = positionAngle * 0.6; // Lean away from center
  const randomVariation = (Math.random() * 2 - 1) * (r * 0.5);
  
  return outwardLean + randomVariation;
}

// Estimate flower radius based on bucket and scale
// Using smaller base radius since flowers are now max 250px wide
function estimateFlowerRadius(bucket, scale) {
  const baseRadius = {
    focal: 125,      // Larger focal flowers (half of 250px max)
    secondary: 100,  // Medium secondary flowers
    greenery: 80,    // Smaller greenery
  };
  return (baseRadius[bucket] || 100) * scale;
}

// Check if two flowers collide based on their positions and estimated sizes
function checkCollision(flower1, flower2) {
  const radius1 = estimateFlowerRadius(flower1.bucket, flower1.scale);
  const radius2 = estimateFlowerRadius(flower2.bucket, flower2.scale);
  const minDistance = radius1 + radius2;
  
  const dx = flower1.x - flower2.x;
  const dy = flower1.y - flower2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Add a small buffer (15% of average radius) for spacing without pushing flowers out
  const buffer = (radius1 + radius2) * 0.15;
  return distance < (minDistance + buffer);
}

export function layoutBouquet(flowers, stageSize) {
  const { width, height } = stageSize;
  const aspectRatio = height / width;
  const isTallMobile = aspectRatio > 1.4;

  // Center flowers horizontally, position them to overlap with vase opening
  const cx = width * 0.5;
  const cy = isTallMobile ? height * 0.51 : height * 0.55;

  // Scale flowers to a nice visible size
  let baseScale = clamp(width / 1400, 1.5, 3.0);
  if (isTallMobile) {
    baseScale *= 0.7;
  }

  // Much tighter ellipse radii to keep flowers within vase bounds
  const radiusMult = isTallMobile ? 0.6 : 0.7;
  const radii = {
    focal: { rx: width * 0.06 * radiusMult, ry: height * 0.03 * radiusMult, yOffset: -20 },
    secondary: { rx: width * 0.08 * radiusMult, ry: height * 0.04 * radiusMult, yOffset: -10 },
    greenery: { rx: width * 0.10 * radiusMult, ry: height * 0.05 * radiusMult, yOffset: 0 },
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
    
    let flowerPos = null;
    let attempts = 0;
    let hasCollision = true;

    // Try to find a position without collision
    while (hasCollision && attempts < MAX_RETRIES) {
      const pos = randomPointInEllipse(cx, cy + config.yOffset, config.rx, config.ry);
      const jitterY = (Math.random() * 2 - 1) * 8;
      
      // Calculate angle from center for outward bloom rotation
      const dx = pos.x - cx;
      const dy = (pos.y + jitterY) - cy;
      const positionAngle = Math.atan2(dx, -dy) * (180 / Math.PI); // Angle in degrees, 0 = up
      
      const rotation = rotationForBucket(flower.bucket, positionAngle);
      
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
      
      const dx = pos.x - cx;
      const dy = (pos.y + jitterY) - cy;
      const positionAngle = Math.atan2(dx, -dy) * (180 / Math.PI);
      const rotation = rotationForBucket(flower.bucket, positionAngle);
      
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
