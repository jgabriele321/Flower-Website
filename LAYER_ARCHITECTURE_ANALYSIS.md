# Layer Architecture Analysis

## Current Architecture

### Structure
- **`backgroundLayer`**: Background image
- **`bouquetLayer`**: Contains both flowers AND vase

### Current Issues
1. Vase can be moved above flowers when clicked (line 81-83)
2. No clear separation between vase and flower z-ordering
3. If multiple vases are added, they compete with flowers in the same layer

---

## Option 1: Dedicated `vaseLayer` (RECOMMENDED)

### Architecture
```
backgroundLayer (bottom)
    ↓
vaseLayer (middle) ← NEW
    ↓
bouquetLayer (top) ← flowers only
```

### Pros ✅
1. **Flowers always render above vases** - guaranteed by layer order
2. **Vases can be reordered among themselves** - clicking vase brings it to front of `vaseLayer` only
3. **Clean separation of concerns** - each layer has a single responsibility
4. **Supports multiple vases** - if feature is added later
5. **Simpler click logic** - no special checks needed

### Cons ❌
1. Requires adding a new layer
2. Need to track vase nodes if multiple vases are supported
3. Slightly more layer management code

### Code Changes Required

#### 1. Add `vaseLayer` variable
```javascript
let vaseLayer;  // Add alongside backgroundLayer and bouquetLayer
```

#### 2. Initialize `vaseLayer` in `setupStage()`
```javascript
function setupStage() {
  stage = new Konva.Stage({
    container,
    width: container.clientWidth,
    height: container.clientHeight,
  });
  backgroundLayer = new Konva.Layer();
  vaseLayer = new Konva.Layer();  // NEW
  bouquetLayer = new Konva.Layer();
  stage.add(backgroundLayer);
  stage.add(vaseLayer);  // NEW - between background and bouquet
  stage.add(bouquetLayer);
  window.addEventListener("resize", handleResize, { passive: true });
}
```

#### 3. Update `buildVase()` to add to `vaseLayer`
```javascript
function buildVase(image, stageSize) {
  // ... existing positioning code ...
  
  vaseNode = new Konva.Image({
    image,
    x,
    y,
    width,
    height: targetHeight,
    listening: true,
    draggable: false,
  });
  
  // Click handler now only moves vase within vaseLayer
  vaseNode.on("mousedown touchstart", () => {
    vaseNode.moveToTop();  // Moves to top of vaseLayer only
    vaseLayer.draw();
  });
  
  vaseLayer.add(vaseNode);  // Changed from bouquetLayer
}
```

#### 4. Update `buildBouquet()` cleanup
```javascript
async function buildBouquet(options = {}) {
  // ...
  try {
    currentFlowers = [];
    bouquetLayer.destroyChildren();
    vaseLayer.destroyChildren();  // NEW - clear vases
    backgroundLayer.destroyChildren();
    // ... rest of function unchanged ...
    
    // Update draw calls
    backgroundLayer.draw();
    vaseLayer.draw();  // NEW
    bouquetLayer.draw();
  }
}
```

#### 5. Update `bringToFront()` comment (no code change needed)
```javascript
function bringToFront(node) {
  node.moveToTop();
  // Flowers move to top of bouquetLayer, which is always above vaseLayer
  bouquetLayer.draw();
}
```

---

## Option 2: Minimum Z-Index for Flowers

### Architecture
- Keep single `bouquetLayer` for both flowers and vase
- Enforce that flowers always have higher z-index than vase

### Pros ✅
1. No new layer needed
2. Simpler layer structure
3. Less code changes

### Cons ❌
1. **More complex logic** - need to track vase position relative to flowers
2. **Edge cases** - what if flowers are added after vase is clicked?
3. **Performance** - need to check/update z-index on every flower click
4. **Fragile** - easy to break if code changes
5. **Doesn't scale** - harder to support multiple vases

### Code Changes Required

#### 1. Track vase z-index
```javascript
let vaseNode = null;
let vaseZIndex = 0;  // Track vase position in layer
```

#### 2. Modify `buildVase()` to track position
```javascript
function buildVase(image, stageSize) {
  // ... existing code ...
  
  vaseNode.on("mousedown touchstart", () => {
    vaseNode.moveToTop();
    vaseZIndex = vaseNode.zIndex();  // Track new position
    bouquetLayer.draw();
  });
  
  bouquetLayer.add(vaseNode);
  vaseZIndex = vaseNode.zIndex();  // Initial position
}
```

#### 3. Modify `bringToFront()` to enforce minimum z-index
```javascript
function bringToFront(node) {
  node.moveToTop();
  
  // If vase exists, ensure flowers stay above it
  if (vaseNode && currentFlowers.includes(node)) {
    const currentVaseZ = vaseNode.zIndex();
    const flowerZ = node.zIndex();
    
    // If flower ended up below vase, move vase down
    if (flowerZ < currentVaseZ) {
      vaseNode.setZIndex(flowerZ - 1);
    }
  }
  
  bouquetLayer.draw();
}
```

#### 4. Ensure flowers are added above vase
```javascript
// In buildBouquet(), after adding flowers:
if (plan.vaseSrc && imageMap[plan.vaseSrc]) {
  buildVase(imageMap[plan.vaseSrc], stageSize);
  // Ensure all flowers are above vase
  currentFlowers.forEach(flower => {
    if (flower.zIndex() <= vaseNode.zIndex()) {
      flower.moveToTop();
    }
  });
}
```

---

## Recommendation: Option 1 (Dedicated `vaseLayer`)

**Why Option 1 is better:**
1. **Cleaner architecture** - follows single responsibility principle
2. **More maintainable** - clear separation makes code easier to understand
3. **More robust** - layer order guarantees correct rendering
4. **Future-proof** - easily supports multiple vases
5. **Simpler logic** - no complex z-index calculations needed
6. **Better performance** - no runtime checks on every click

**When Option 2 might be preferred:**
- If you want minimal code changes
- If you're certain you'll never need multiple vases
- If layer count is a concern (though 3 layers is still very reasonable)

---

## Implementation Summary

### Option 1 Changes:
- ✅ Add `vaseLayer` variable
- ✅ Initialize `vaseLayer` in `setupStage()`
- ✅ Change `buildVase()` to add to `vaseLayer`
- ✅ Update `buildBouquet()` cleanup to clear `vaseLayer`
- ✅ Update draw calls to include `vaseLayer.draw()`

### Option 2 Changes:
- ✅ Add `vaseZIndex` tracking variable
- ✅ Modify `bringToFront()` with z-index enforcement logic
- ✅ Update `buildVase()` to track z-index
- ✅ Ensure flowers are added above vase in `buildBouquet()`

**Total LOC change:** Option 1 ~15 lines, Option 2 ~25 lines (more complex)
