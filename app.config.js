// app.json stays the source of truth for everything else; this file only
// adds one Windows-only override on top of it.
//
// The Android SDK's default CMake package (3.22.1) bundles Ninja 1.10.2,
// which doesn't support Windows long paths at all - New Architecture's CMake
// codegen for react-native-gesture-handler produces object-file paths long
// enough to exceed Win32's 260-character limit regardless of the
// LongPathsEnabled registry setting. CMake 3.31.6 bundles Ninja 1.12.1,
// which does. See docs.expo.dev/troubleshooting/windows-long-paths and
// DECISIONS.md.
//
// Scoped to Windows only (not set in app.json directly): EAS Build runs on
// Linux, where CMake 3.31.6 isn't installed, so forcing it unconditionally
// breaks cloud builds with "CMake '3.31.6' was not found in SDK, PATH, or by
// cmake.dir property".
const isWindows = process.platform === 'win32';

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ['expo-build-properties', { android: isWindows ? { cmakeVersion: '3.31.6' } : {} }],
  ],
});
