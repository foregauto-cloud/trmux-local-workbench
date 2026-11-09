#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ANDROID_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$ANDROID_DIR/.." && pwd)"
: "${PREFIX:=/data/data/com.termux/files/usr}"
: "${ANDROID_HOME:=$HOME/android-sdk}"
: "${ANDROID_SDK_ROOT:=$ANDROID_HOME}"
: "${JAVA_HOME:=$PREFIX/lib/jvm/java-21-openjdk}"
export ANDROID_HOME ANDROID_SDK_ROOT JAVA_HOME
export PATH="$JAVA_HOME/bin:$PREFIX/bin:$PATH"

if ! command -v java >/dev/null 2>&1; then
  echo "Java not found. Install with: pkg install openjdk-21" >&2
  exit 1
fi
if ! command -v aapt2 >/dev/null 2>&1; then
  echo "Termux-native aapt2 not found. Install with: pkg install aapt2" >&2
  exit 1
fi
if [ ! -d "$ANDROID_HOME/platforms/android-35" ]; then
  echo "Missing Android SDK platform 35 under $ANDROID_HOME. Install platforms;android-35 with sdkmanager." >&2
  exit 1
fi
if [ ! -d "$ANDROID_HOME/build-tools/34.0.0" ]; then
  echo "Missing Android SDK Build-Tools 34.0.0 under $ANDROID_HOME. Install build-tools;34.0.0 with sdkmanager." >&2
  exit 1
fi

# AGP's Maven aapt2 binary targets glibc/Linux, not Android's Bionic libc.
# Override it only in this Termux user's Gradle settings, not the shared project.
GRADLE_PROPS="$HOME/.gradle/gradle.properties"
mkdir -p "$(dirname "$GRADLE_PROPS")"
TMP_PROPS="${GRADLE_PROPS}.trmux.tmp"
if [ -f "$GRADLE_PROPS" ]; then
  grep -v '^android\.aapt2FromMavenOverride=' "$GRADLE_PROPS" > "$TMP_PROPS" || true
else
  : > "$TMP_PROPS"
fi
printf '\nandroid.aapt2FromMavenOverride=%s\n' "$(command -v aapt2)" >> "$TMP_PROPS"
mv "$TMP_PROPS" "$GRADLE_PROPS"

cd "$ANDROID_DIR"
gradle assembleDebug
APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK" ]; then
  echo "Gradle returned success but expected APK was not found: $APK" >&2
  exit 1
fi
printf '\nBuild succeeded. APK: %s\n' "$APK"
ls -lh "$APK"
printf 'To copy to Downloads: cp "%s" "$HOME/storage/downloads/"\n' "$APK"
