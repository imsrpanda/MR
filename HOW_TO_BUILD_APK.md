# How to Build Android APK

Since your system doesn't have Java/Android SDK installed in the PATH, you'll need to use Android Studio to build the APK.

## Prerequisites
1.  **Download and Install Android Studio**: [https://developer.android.com/studio](https://developer.android.com/studio)
2.  During installation, make sure to install the **Android SDK** and **Android Virtual Device** components.

## Steps to Build

I have already prepared the project for you by running the build and sync commands.

1.  **Open Android Studio**.
2.  Select **Open** and navigate to:
    `c:\Users\susmi\Downloads\MR\android`
3.  Wait for Gradle sync to finish (it might take a few minutes to download dependencies).
4.  **Build the APK**:
    *   Go to menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5.  **Locate the APK**:
    *   Once finished, a notification will appear. Click **locate** to find the `app-debug.apk` file.
    *   Or find it manually at: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Running on Mobile
1.  **Enable Developer Options** on your Android phone (Settings > About Phone > Tap Build Number 7 times).
2.  **Enable USB Debugging** in Developer Options.
3.  Connect your phone via USB.
4.  In Android Studio, click the green **Run** (Play) button in the toolbar. Select your device.

## Updating the App
If you make changes to the React code later, run these commands in your terminal before building again:

```powershell
npm run build
npx cap sync android
```
