# VNPT Modem Android

This project packages the G040H, NS V1, NS V2, and OneLink modules into an Android APK. The app runs its local Node.js server on port **3001**.

## Build with GitHub Actions

1. Push the project to GitHub with the source folders and `.github/workflows/android-apk.yml`.
2. Open **Actions** and run **Build Android APK**, or push to the `main`/`master` branch.
3. Download `app-debug.apk` from the `vnpt-modem-debug-apk` artifact and install it on the phone.

## Run on a computer

Use Node.js 18 or newer and run `npm start`. Open <http://127.0.0.1:3001/>.
