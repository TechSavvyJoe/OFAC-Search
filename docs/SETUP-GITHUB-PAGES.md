# GitHub Pages Setup Instructions

Follow these steps to host your privacy policy on GitHub Pages and get the URL for the Chrome Web Store.

## Step 1: Create a GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click the **+** button → **New repository**
3. Name it: `ofac-compliance-search`
4. Make it **Public**
5. Click **Create repository**

## Step 2: Push Your Code

Run these commands in your terminal:

```bash
cd "/Volumes/Macintosh HD 1/Users/joemacintel/Joe M1 Mac Backup Drive/Software_Projects/Automotive_Dealer_Projects/OFAC Search"

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit with privacy policy"

# Add your GitHub repo as remote (replace YOUR-USERNAME)
git remote add origin https://github.com/YOUR-USERNAME/ofac-compliance-search.git

# Push
git push -u origin main
```

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (gear icon)
3. Scroll down to **Pages** in the left sidebar
4. Under "Source", select:
   - **Branch:** `main`
   - **Folder:** `/docs`
5. Click **Save**

## Step 4: Get Your Privacy Policy URL

After a few minutes, your privacy policy will be live at:

```
https://YOUR-USERNAME.github.io/ofac-compliance-search/privacy-policy.html
```

**Example:** `https://techsavvyjoe.github.io/ofac-compliance-search/privacy-policy.html`

## Step 5: Update Chrome Web Store

1. Go to the Chrome Web Store Developer Dashboard
2. Edit your extension
3. Go to **Store listing** or **Privacy** tab
4. Paste your new privacy policy URL
5. Resubmit for review

---

## Important Notes

- **Don't use a URL shortener** - Google requires direct links
- **Don't use Google Docs/Drive** - Those are "owner sites" and won't be accepted
- **The URL must be publicly accessible** - GitHub Pages is perfect for this
- **Update the email address** in `privacy-policy.html` before pushing
