---
description: How to build the Android APK
---

1. Build the web assets:
```bash
npm run build
```

2. Sync the changes to the Android native project:
```bash
npx cap sync android
```

3. Open the project in Android Studio to build the APK:
```bash
npx cap open android
```
// turbo
4. Alternatively, build the APK directly from the command line (if Gradle is configured):
```bash
cd android && ./gradlew assembleDebug
```
