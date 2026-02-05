# Bloom Studio 🌸

A beautiful, interactive bouquet arranger built with Konva.js and Vite. Create stunning digital flower arrangements with pixel-perfect interaction, intelligent collision detection, and a lightweight, manifest-driven architecture.

![Bloom Studio](https://img.shields.io/badge/status-active-success)
![Vite](https://img.shields.io/badge/vite-7.3.1-646CFF?logo=vite)
![Konva](https://img.shields.io/badge/konva-10.2.0-FF6B6B)

## ✨ Features

- **🎨 Dynamic Bouquet Generation**: Automatically creates beautiful arrangements with 3 focal flowers, 4 secondary flowers, and 5 greenery elements
- **🎯 Pixel-Perfect Interaction**: Click detection only responds to opaque flower pixels, not transparent areas
- **📐 Smart Layout System**: Collision detection ensures flowers are well-distributed without excessive overlapping
- **🎭 Multiple Color Palettes**: Choose from blush, blue, sunset, white_green, and tropical palettes
- **🖱️ Arrange Mode**: Drag and drop flowers to create your perfect arrangement
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **⚡ Performance Optimized**: 
  - Manifest-driven asset loading (only loads images needed for current bouquet)
  - WebP format with alpha channel preservation
  - Automatic image optimization (max 1024px)
- **🎪 Interactive Features**:
  - Click/tap flowers to bring them to the front
  - Drag flowers in Arrange Mode
  - Generate new random bouquets instantly
  - Responsive canvas that adapts to viewport size

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ (for asset preparation scripts)
- Pillow library (for Python scripts)

### Installation

```bash
# Clone the repository
git clone https://github.com/jgabriele321/Flower-Website.git
cd Flower-Website

# Install dependencies
npm install

# Start development server
npm run dev
```

Open the URL shown in your terminal (typically `http://localhost:5173/`).

### Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## 📁 Project Structure

```
.
├── src/
│   ├── main.js          # Main application logic and Konva stage setup
│   ├── bouquet.js       # Bouquet generation and layout algorithms
│   └── style.css         # Application styles
├── public/
│   ├── flowers/         # Flower assets organized by palette/bucket
│   │   ├── manifest.json
│   │   ├── blush/
│   │   │   ├── focal/
│   │   │   ├── secondary/
│   │   │   └── greenery/
│   │   └── [other palettes]/
│   ├── vases/           # Vase images
│   └── backgrounds/     # Background images
├── scripts/
│   ├── prep_assets.py      # Convert and optimize images
│   ├── categorize_flowers.py  # Auto-categorize flowers by color
│   └── review_flowers.py     # Analyze flower image quality
└── index.html           # Entry point
```

## 🎨 Adding Your Own Flowers

### Method 1: Using Source Images

1. **Organize your source images** in the following structure:
   ```
   raw_flowers/
     blush/
       focal/*.png
       secondary/*.png
       greenery/*.png
     blue/
       focal/*.png
       ...
   ```

2. **Run the prep script** to convert and optimize:
   ```bash
   # Activate Python virtual environment (if using)
   source .venv/bin/activate
   
   # Run prep script
   python scripts/prep_assets.py \
     --source ./raw_flowers \
     --output ./public/flowers \
     --max-size 1024 \
     --vase-dir ./public/vases \
     --background-dir ./public/backgrounds
   ```

   The script will:
   - Convert PNG/JPG to WebP format (preserving alpha channel)
   - Resize images to max 1024px (maintaining aspect ratio)
   - Generate/update `manifest.json` automatically

### Method 2: Direct WebP Upload

If you already have WebP files:
1. Place them directly in `public/flowers/<palette>/<bucket>/`
2. Run the prep script to regenerate the manifest:
   ```bash
   python scripts/prep_assets.py --output ./public/flowers
   ```

### Palettes and Buckets

**Palettes** (color schemes):
- `blush` - Pink, peach, coral tones
- `blue` - Blue, purple, lavender tones
- `sunset` - Orange, red, warm yellow tones
- `white_green` - Green and low-saturation whites
- `tropical` - Bright yellow and hot pink tones

**Buckets** (flower types):
- `focal` - Large, prominent flowers (roses, peonies, dahlias, etc.)
- `secondary` - Medium-sized supporting flowers
- `greenery` - Leaves, stems, and foliage

## 🎮 Usage

### Basic Interaction

1. **View Bouquet**: On load, a random bouquet is automatically generated
2. **New Bouquet**: Click "New Bouquet" to generate a fresh arrangement
3. **Arrange Mode**: 
   - Toggle "Arrange Mode" to enable/disable flower dragging
   - In Arrange Mode, click and drag flowers to reposition them
   - Click any flower to bring it to the front
4. **Click Detection**: Only clicks on opaque flower pixels will trigger interaction (transparent areas are ignored)

### Layout Algorithm

The bouquet layout uses:
- **Elliptical distribution**: Flowers are positioned within ellipses based on their bucket type
- **Collision detection**: Prevents excessive overlapping with retry logic (up to 10 attempts per flower)
- **Smart scaling**: Different scales for focal (100%), secondary (90%), and greenery (78%)
- **Random rotation**: Natural variation with bucket-specific rotation ranges
- **Responsive sizing**: Adapts to screen size and aspect ratio

## 🛠️ Development

### Available Scripts

```bash
npm run dev      # Start development server with hot reload
npm run build    # Build for production
npm run preview  # Preview production build locally
```

### Key Technologies

- **Konva.js**: 2D canvas library for rendering and interaction
- **Vite**: Fast build tool and dev server
- **WebP**: Modern image format with alpha channel support
- **Python/Pillow**: Image processing and optimization

### Code Architecture

- **`src/main.js`**: 
  - Konva stage and layer management
  - Image loading and caching
  - Event handling and interactivity
  - Pixel-perfect hit detection using `cache()` and `drawHitFromCache()`

- **`src/bouquet.js`**:
  - Bouquet generation from manifest
  - Layout algorithm with collision detection
  - Flower positioning and scaling logic

## 🚢 Deployment

### GitHub Pages

This project includes a GitHub Actions workflow for automatic deployment:

1. **Push to main branch**: The workflow automatically builds and deploys
2. **Configure GitHub Pages**: 
   - Go to repository Settings → Pages
   - Set source to "GitHub Actions"
3. **Custom base path** (if needed): Update `base` in `vite.config.js` for subdirectory deployments

The workflow (`.github/workflows/deploy.yml`) will:
- Build the project using Vite
- Deploy the `dist/` directory to GitHub Pages
- Run on every push to `main`

### Manual Deployment

```bash
npm run build
# Upload the contents of dist/ to your web server
```

## 🎯 Performance Optimizations

- **Lazy Loading**: Only loads images needed for the current bouquet (10-14 flowers + vase + background)
- **WebP Format**: Smaller file sizes with alpha channel support
- **Image Optimization**: Automatic resizing to max 1024px
- **Canvas Caching**: Konva caching for efficient hit detection
- **Responsive Canvas**: Canvas resizes to viewport, no unnecessary rendering

## 🐛 Troubleshooting

### Images not loading?
- Check that `manifest.json` exists in `public/flowers/`
- Verify image paths match the manifest structure
- Run the prep script to regenerate the manifest

### Click detection not working?
- Ensure images have transparent backgrounds (PNG/WebP with alpha)
- Check browser console for errors
- Verify Konva cache is working (check network tab)

### Layout looks jumbled?
- The collision detection should prevent excessive overlap
- Try generating a new bouquet
- Check that flower images have reasonable dimensions

## 📝 License

ISC License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- Built with [Konva.js](https://konvajs.org/)
- Powered by [Vite](https://vitejs.dev/)

---

Made with ❤️ for creating beautiful digital bouquets
