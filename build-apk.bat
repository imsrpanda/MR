@echo off
cd c:\Users\Dell\Downloads\mr

echo Cleaning dist folder...
rmdir /s /q dist 2>nul

echo Building web app...
call npm run build

if exist dist\index.html (
    echo Build successful!
    echo.
    echo Syncing with Capacitor...
    call npx cap sync android
    
    if exist android\app\src\main\assets\capacitor.config.json (
        echo Capacitor sync successful!
        echo.
        echo Building APK...
        cd android
        call gradlew.bat assembleDebug
        
        if exist app\build\outputs\apk\debug\app-debug.apk (
            echo APK built successfully at:
            echo app\build\outputs\apk\debug\app-debug.apk
            cd ..
        ) else (
            echo APK build failed!
        )
    ) else (
        echo Capacitor sync failed!
    )
) else (
    echo Build failed!
    pause
)
