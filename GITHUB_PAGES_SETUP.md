# GitHub Pages Setup - Quick Start

## What's Been Set Up

✅ **GitHub Actions Workflow** - Automatic deployment on every push
✅ **Vite Config Updated** - Correct base path for GitHub Pages
✅ **Build Scripts** - Ready to generate production build

## Your Deployment URL

Once you complete the steps below, your app will be available at:

```
https://YOUR_GITHUB_USERNAME.github.io/mr/
```

## Next Steps (4 Steps Only!)

### Step 1: Commit Changes
```bash
cd c:\Users\Dell\Downloads\mr
git add .
git commit -m "Add GitHub Pages deployment setup"
git push origin main
```

### Step 2: Enable GitHub Pages
1. Go to https://github.com/YOUR_USERNAME/mr/settings
2. Scroll to "Pages" section
3. Under "Build and deployment", select "GitHub Actions" as source
4. Save

### Step 3: Wait for Deployment
1. Go to https://github.com/YOUR_USERNAME/mr/actions
2. Watch the "Deploy to GitHub Pages" workflow run
3. It should complete in 1-2 minutes

### Step 4: Access Your Site
Once deployment is complete, visit:
```
https://YOUR_GITHUB_USERNAME.github.io/mr/
```

---

## Advanced Options

### Option A: Custom Domain
Edit `.github/workflows/deploy.yml` and uncomment the `cname` line with your domain.

### Option B: Deploy to Root
If you want the site at `https://YOUR_USERNAME.github.io/` instead of `/mr/`:

Change in `vite.config.js`:
```javascript
base: process.env.NODE_ENV === 'production' ? '/' : '/',
```

And update `.github/workflows/deploy.yml` workflow triggers if needed.

### Option C: Switch Branch
The workflow currently deploys from `main` or `master`. To change:

Edit `.github/workflows/deploy.yml`:
```yaml
on:
  push:
    branches: [ your-branch-name ]
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 Page Not Found | Check GitHub Pages is enabled in Settings → Pages |
| Build Error in Actions | Check the Actions log, usually missing dependencies |
| Blank White Page | Check browser console for errors |
| Routes not working | Make sure React Router uses `HashRouter` or update base path |

---

**Need Help?** Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed information.
