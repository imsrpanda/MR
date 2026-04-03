---
description: How to build the Android APK via Command Line
---

1. **Prerequisite**: Set JAVA_HOME.
   - The user has installed JDK at: `C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot`
   - Use a `.bat` script to set env vars and call `gradlew.bat` (inline env vars don't work with gradlew):
   ```bat
   set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"
   set "PATH=%JAVA_HOME%\bin;%PATH%"
   ```

2. **Build Web Assets**:
   ```bash
   npm run build
   ```

3. **Sync Native Project**:
   ```bash
   npx cap sync android
   ```

4. **Build APK (Debug)**:
   ```bash
   cd android
   ./gradlew assembleDebug
   cd ..
   ```

5. **Locate APK**:
   The built APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`
