@echo off
git add -A
git commit -m "fix: resolve white screen on Android APK" -m "- BrowserRouter basename was hardcoded to /mr for GitHub Pages only" -m "- On Android/Capacitor, app is served from root causing all routes to fail" -m "- Fixed by detecting Capacitor.isNativePlatform and using basename dynamically" -m "- Updated build workflow with correct JDK path jdk-17.0.18.8-hotspot"
echo Commit done.
