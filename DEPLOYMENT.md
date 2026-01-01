# GitHub Pages Deployment Guide

This project is set up to automatically deploy to GitHub Pages whenever you push to the main/master branch.

## Setup Instructions

### 1. Push Your Code to GitHub
Make sure your project is pushed to a GitHub repository:

```bash
git add .
git commit -m "Setup GitHub Pages deployment"
git push origin main
```

### 2. Enable GitHub Pages

1. Go to your GitHub repository
2. Navigate to **Settings** → **Pages**
3. Under "Build and deployment":
   - **Source**: Select "GitHub Actions"
   - This will automatically use the workflow we've created

### 3. Deployment URL

Your site will be available at:
- **Default**: `https://YOUR_USERNAME.github.io/mr/`
- **Custom Domain**: You can add a custom domain in Settings → Pages

(Replace `YOUR_USERNAME` with your actual GitHub username and `mr` with your repo name if different)

## How It Works

The GitHub Actions workflow (`.github/workflows/deploy.yml`):

1. **Triggers** on every push to `main` or `master` branch
2. **Installs** Node.js dependencies
3. **Builds** the project using `npm run build` (generates `/dist` folder)
4. **Deploys** the `/dist` folder to GitHub Pages automatically

## Optional: Custom Domain

If you have a custom domain:

1. Update `.github/workflows/deploy.yml` and set your domain in `cname` field:
   ```yaml
   cname: yourdomain.com
   ```

2. Add DNS records pointing to GitHub Pages (check GitHub Pages documentation)

3. Create a `CNAME` file in your repo root:
   ```
   yourdomain.com
   ```

## Check Deployment Status

1. Go to your repository
2. Click **Actions** tab
3. Watch the workflow run
4. Once completed, your site is live!

## Troubleshooting

- **Build fails**: Check the Actions tab logs
- **Page not loading**: Make sure GitHub Pages is enabled in Settings
- **404 errors**: Verify your `vite.config.js` has correct `base` path
- **Custom domain not working**: Check DNS records and CNAME file

## Local Testing

To test the build locally before pushing:

```bash
npm run build
npm run preview
```

This will show how your site looks in production.

---

**For more details**, visit: https://pages.github.com/
