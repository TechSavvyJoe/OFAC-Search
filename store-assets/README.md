# Chrome Web Store Media Assets

This folder contains all the media assets needed for Chrome Web Store submission.

## Icons (in `/icons` folder)

- `icon16.svg` - 16x16 toolbar icon
- `icon48.svg` - 48x48 extension management icon
- `icon128.svg` - 128x128 Chrome Web Store icon

## Promotional Images

These are HTML templates - open each in Chrome and take a screenshot at the exact dimensions:

| File                          | Size     | Purpose                   |
| ----------------------------- | -------- | ------------------------- |
| `promo-small-440x280.html`    | 440×280  | Small promotional tile    |
| `promo-large-920x680.html`    | 920×680  | Large promotional tile    |
| `promo-marquee-1400x560.html` | 1400×560 | Marquee promotional image |

### How to Create PNG Images

1. **Open the HTML file** in Chrome
2. **Right-click → Inspect** to open DevTools
3. Press **Cmd+Shift+P** (Mac) or **Ctrl+Shift+P** (Windows)
4. Type **"screenshot"** and select **"Capture full size screenshot"**
5. Save the PNG file

Or use the Chrome flag method:

```bash
# Small tile
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --headless --screenshot --window-size=440,280 "file:///path/to/promo-small-440x280.html"

# Large tile
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --headless --screenshot --window-size=920,680 "file:///path/to/promo-large-920x680.html"

# Marquee
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --headless --screenshot --window-size=1400,560 "file:///path/to/promo-marquee-1400x560.html"
```

## Converting SVG Icons to PNG

For the Chrome Web Store, you may need PNG icons. Use any of these methods:

### Online Converter

- https://svgtopng.com/
- https://cloudconvert.com/svg-to-png

### Command Line (requires Inkscape or ImageMagick)

```bash
# Using Inkscape
inkscape -w 128 -h 128 icons/icon128.svg -o icons/icon128.png
inkscape -w 48 -h 48 icons/icon48.svg -o icons/icon48.png
inkscape -w 16 -h 16 icons/icon16.svg -o icons/icon16.png
```

## Screenshots

Take 1-5 screenshots of your extension in action (1280×800 or 640×400):

1. Main search interface with sample data
2. Search results showing "No Match Found"
3. Print certificate preview
4. Search history section
