# KMP Bootstrap + Map Interop Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Kotlin/Compose Multiplatform mobile project (`mobile/`) in the smartroute repo and prove the expect/actual native-map embedding pattern (MapLibre) on Android, with iOS compilation verified via CI.

**Architecture:** A new self-contained Gradle build at `mobile/` (NOT part of the pnpm/Turborepo workspace). One module `composeApp` with `commonMain` (shared UI + logic), `androidMain` (MainActivity, MapLibre actual), `iosMain` (Compose entry point, map placeholder actual). iOS has no Xcode wrapper yet — Phase 1's iOS deliverable is "the Kotlin framework links on a macOS CI runner".

**Tech Stack:** Kotlin 2.1.0, Compose Multiplatform 1.7.3, AGP 8.7.3, Gradle 8.11.1 (wrapper), MapLibre Android SDK 11.5.2, kotlin.test, ktlint (jlleitschuh plugin 12.1.2), GitHub Actions.

## Global Constraints

- **Host OS is Windows:** Kotlin/Native Apple targets DO NOT compile locally. Never run `:composeApp:linkDebugFrameworkIos*` locally — that is CI's job (macOS runner). Local verification = Android only.
- **Spec:** `docs/superpowers/specs/2026-07-06-smartroute-traveler-thesis-spec.md` (v2.0). This plan implements Phase 1 (§13).
- **Map provider for the spike is MapLibre** (`org.maplibre.gl:android-sdk:11.5.2`, demo style `https://demotiles.maplibre.org/style.json`, no API key). Mapbox swap is a later decision per spec §8.3.
- Android: `namespace`/`applicationId` = `com.smartroute.traveler`, `compileSdk = 35`, `minSdk = 26`, `targetSdk = 35`, JDK 17.
- Version pins (verbatim, from `gradle/libs.versions.toml` defined in Task 2): kotlin `2.1.0`, composeMultiplatform `1.7.3`, agp `8.7.3`, androidx-activity `1.9.3`, lifecycleRuntimeCompose `2.8.7`, maplibre `11.5.2`, ktlint plugin `12.1.2`.
- **Commit messages must never mention Claude, AI, or code generation.** Author is RyoFallen only. Use conventional commits (`feat(mobile):`, `chore(mobile):`, `ci:`).
- The existing Expo app at `apps/mobile` stays untouched in this plan. Do not delete or modify it.
- Do not modify `.github/workflows/ci.yml` (backend CI). Mobile gets its own workflow file.

---

### Task 1: Local Toolchain (JDK 17, Gradle, Android SDK)

**Files:**

- No repo files. Machine setup only.

**Interfaces:**

- Produces: working `java` (17), `gradle` (any 8.x, used once to generate the wrapper), Android SDK with platform 35 + emulator, `ANDROID_HOME` set.

- [ ] **Step 1: Install JDK 17 and Gradle via winget**

Run (PowerShell):

```powershell
winget install --id EclipseAdoptium.Temurin.17.JDK --accept-package-agreements --accept-source-agreements
winget install --id Gradle.Gradle --accept-package-agreements --accept-source-agreements
```

Expected: both installs succeed. **Open a new terminal afterwards** so PATH updates apply.

- [ ] **Step 2: Install Android Studio (provides SDK + emulator)**

Run (PowerShell):

```powershell
winget install --id Google.AndroidStudio --accept-package-agreements --accept-source-agreements
```

Then launch Android Studio once → complete the setup wizard (Standard). In **SDK Manager**, ensure installed: _Android SDK Platform 35_, _Android SDK Build-Tools 35.x_, _Android Emulator_, _Android SDK Platform-Tools_. In **Device Manager**, create one AVD (e.g., Pixel 8, API 35). This is a manual GUI step — ask the user (Burak) to do it and confirm.

- [ ] **Step 3: Set ANDROID_HOME**

Run (PowerShell):

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

Open a new terminal, then verify all three tools:

```powershell
java -version        # expect: openjdk version "17.x"
gradle --version     # expect: Gradle 8.x
Get-ChildItem $env:ANDROID_HOME\platforms   # expect: android-35
```

Expected: all three succeed. Nothing to commit.

---

### Task 2: Scaffold the KMP Project

**Files:**

- Create: `mobile/settings.gradle.kts`
- Create: `mobile/build.gradle.kts`
- Create: `mobile/gradle.properties`
- Create: `mobile/gradle/libs.versions.toml`
- Create: `mobile/.gitignore`
- Create: `mobile/composeApp/build.gradle.kts`
- Create: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/App.kt`
- Create: `mobile/composeApp/src/androidMain/kotlin/com/smartroute/traveler/MainActivity.kt`
- Create: `mobile/composeApp/src/androidMain/AndroidManifest.xml`
- Create: `mobile/composeApp/src/iosMain/kotlin/com/smartroute/traveler/MainViewController.kt`
- Create (generated): `mobile/gradlew`, `mobile/gradlew.bat`, `mobile/gradle/wrapper/*`

**Interfaces:**

- Produces: `@Composable fun App()` in `com.smartroute.traveler` (root UI, Tasks 4–5 build on it); Gradle tasks `:composeApp:assembleDebug`, `:composeApp:testDebugUnitTest`.

- [ ] **Step 1: Create `mobile/.gitignore`**

```gitignore
.gradle/
build/
local.properties
.kotlin/
.idea/
*.iml
captures/
```

- [ ] **Step 2: Create `mobile/gradle/libs.versions.toml`**

```toml
[versions]
kotlin = "2.1.0"
composeMultiplatform = "1.7.3"
agp = "8.7.3"
androidx-activity = "1.9.3"
lifecycleRuntimeCompose = "2.8.7"
maplibre = "11.5.2"
ktlint = "12.1.2"

[libraries]
androidx-activity-compose = { module = "androidx.activity:activity-compose", version.ref = "androidx-activity" }
androidx-lifecycle-runtime-compose = { module = "androidx.lifecycle:lifecycle-runtime-compose", version.ref = "lifecycleRuntimeCompose" }
maplibre-android = { module = "org.maplibre.gl:android-sdk", version.ref = "maplibre" }
kotlin-test = { module = "org.jetbrains.kotlin:kotlin-test", version.ref = "kotlin" }

[plugins]
androidApplication = { id = "com.android.application", version.ref = "agp" }
kotlinMultiplatform = { id = "org.jetbrains.kotlin.multiplatform", version.ref = "kotlin" }
composeMultiplatform = { id = "org.jetbrains.compose", version.ref = "composeMultiplatform" }
composeCompiler = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
ktlint = { id = "org.jlleitschuh.gradle.ktlint", version.ref = "ktlint" }
```

- [ ] **Step 3: Create `mobile/settings.gradle.kts`**

```kotlin
rootProject.name = "smartroute-mobile"

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

include(":composeApp")
```

- [ ] **Step 4: Create `mobile/build.gradle.kts`**

```kotlin
plugins {
    alias(libs.plugins.androidApplication) apply false
    alias(libs.plugins.kotlinMultiplatform) apply false
    alias(libs.plugins.composeMultiplatform) apply false
    alias(libs.plugins.composeCompiler) apply false
}
```

- [ ] **Step 5: Create `mobile/gradle.properties`**

```properties
org.gradle.jvmargs=-Xmx4g -Dfile.encoding=UTF-8
org.gradle.caching=true
org.gradle.configuration-cache=true
kotlin.code.style=official
android.useAndroidX=true
android.nonTransitiveRClass=true
```

- [ ] **Step 6: Create `mobile/composeApp/build.gradle.kts`**

```kotlin
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    androidTarget {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }

    listOf(
        iosArm64(),
        iosSimulatorArm64(),
    ).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "ComposeApp"
            isStatic = true
        }
    }

    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            implementation(compose.components.resources)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
        }
        androidMain.dependencies {
            implementation(libs.androidx.activity.compose)
            implementation(libs.androidx.lifecycle.runtime.compose)
            implementation(libs.maplibre.android)
        }
    }
}

android {
    namespace = "com.smartroute.traveler"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.smartroute.traveler"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
```

- [ ] **Step 7: Create `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/App.kt`**

```kotlin
package com.smartroute.traveler

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

@Composable
fun App() {
    MaterialTheme {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            Text("SmartRoute Traveler")
        }
    }
}
```

- [ ] **Step 8: Create `mobile/composeApp/src/androidMain/AndroidManifest.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:label="SmartRoute Traveler"
        android:theme="@android:style/Theme.Material.Light.NoActionBar"
        android:supportsRtl="true">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

- [ ] **Step 9: Create `mobile/composeApp/src/androidMain/kotlin/com/smartroute/traveler/MainActivity.kt`**

```kotlin
package com.smartroute.traveler

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            App()
        }
    }
}
```

- [ ] **Step 10: Create `mobile/composeApp/src/iosMain/kotlin/com/smartroute/traveler/MainViewController.kt`**

```kotlin
package com.smartroute.traveler

import androidx.compose.ui.window.ComposeUIViewController
import platform.UIKit.UIViewController

fun MainViewController(): UIViewController = ComposeUIViewController { App() }
```

- [ ] **Step 11: Generate the Gradle wrapper**

Run (from `mobile/`):

```powershell
gradle wrapper --gradle-version 8.11.1
```

Expected: creates `gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar`, `gradle/wrapper/gradle-wrapper.properties`. From now on, always use `./gradlew` (never global `gradle`).

- [ ] **Step 12: Build the Android APK**

Run (from `mobile/`):

```powershell
./gradlew :composeApp:assembleDebug
```

Expected: `BUILD SUCCESSFUL`. First run downloads dependencies (several minutes). A warning that iOS targets are disabled on this host is NORMAL on Windows.

- [ ] **Step 13: Run on emulator (manual verification)**

Start the AVD from Android Studio Device Manager, then:

```powershell
./gradlew :composeApp:installDebug
```

Launch "SmartRoute Traveler" on the emulator. Expected: app opens showing centered text "SmartRoute Traveler". Ask the user to confirm.

- [ ] **Step 14: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): bootstrap Kotlin/Compose Multiplatform project"
```

---

### Task 3: Shared Unit Test Setup (kotlin.test in commonTest)

**Files:**

- Create: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/domain/Formatters.kt`
- Test: `mobile/composeApp/src/commonTest/kotlin/com/smartroute/traveler/domain/FormattersTest.kt`

**Interfaces:**

- Produces: `fun formatPrice(amountMinorUnits: Long, currencyCode: String): String` in `com.smartroute.traveler.domain` — e.g. `formatPrice(84700, "USD")` → `"USD 847.00"`. Later phases reuse this for trip cost display.

- [ ] **Step 1: Write the failing test**

`mobile/composeApp/src/commonTest/kotlin/com/smartroute/traveler/domain/FormattersTest.kt`:

```kotlin
package com.smartroute.traveler.domain

import kotlin.test.Test
import kotlin.test.assertEquals

class FormattersTest {
    @Test
    fun formatsWholeAmount() {
        assertEquals("USD 847.00", formatPrice(84700, "USD"))
    }

    @Test
    fun formatsSubUnitAmount() {
        assertEquals("EUR 12.05", formatPrice(1205, "EUR"))
    }

    @Test
    fun formatsZero() {
        assertEquals("USD 0.00", formatPrice(0, "USD"))
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `mobile/`): `./gradlew :composeApp:testDebugUnitTest`
Expected: FAIL — compilation error, `formatPrice` unresolved.

- [ ] **Step 3: Write minimal implementation**

`mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/domain/Formatters.kt`:

```kotlin
package com.smartroute.traveler.domain

fun formatPrice(amountMinorUnits: Long, currencyCode: String): String {
    val major = amountMinorUnits / 100
    val minor = amountMinorUnits % 100
    val minorPadded = minor.toString().padStart(2, '0')
    return "$currencyCode $major.$minorPadded"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `mobile/`): `./gradlew :composeApp:testDebugUnitTest`
Expected: `BUILD SUCCESSFUL`, 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/domain/Formatters.kt mobile/composeApp/src/commonTest/
git commit -m "test(mobile): commonTest harness with price formatter"
```

---

### Task 4: ktlint

**Files:**

- Modify: `mobile/build.gradle.kts`
- Modify: `mobile/gradle/libs.versions.toml` (plugin already declared in Task 2 — verify only)

**Interfaces:**

- Produces: Gradle tasks `ktlintCheck` / `ktlintFormat` across all modules. CI (Task 6) runs `ktlintCheck`.

- [ ] **Step 1: Apply the ktlint plugin to all projects**

Replace the full contents of `mobile/build.gradle.kts` with:

```kotlin
plugins {
    alias(libs.plugins.androidApplication) apply false
    alias(libs.plugins.kotlinMultiplatform) apply false
    alias(libs.plugins.composeMultiplatform) apply false
    alias(libs.plugins.composeCompiler) apply false
    alias(libs.plugins.ktlint) apply false
}

subprojects {
    apply(plugin = "org.jlleitschuh.gradle.ktlint")

    // Compose Multiplatform registers generated resource accessors (package
    // smartroute_mobile.composeapp.generated.resources) as source dirs, and
    // ktlint-gradle lints registered source dirs even under build/. Glob
    // excludes do not work here (they match relative paths within each
    // registered source root), so a predicate on the absolute path is used.
    configure<org.jlleitschuh.gradle.ktlint.KtlintExtension> {
        filter {
            exclude { entry -> entry.file.toString().contains("generated") }
        }
    }
}
```

- [ ] **Step 2: Run ktlint and fix violations**

Run (from `mobile/`):

```powershell
./gradlew ktlintCheck
```

If violations are reported, run `./gradlew ktlintFormat`, review the diff, and re-run `ktlintCheck`.
Expected final state: `BUILD SUCCESSFUL`.

Note: ktlint's default `function-naming` rule flags `@Composable` PascalCase functions. If `App`/`RouteMap` are flagged, create `mobile/.editorconfig`:

```ini
root = true

[*.{kt,kts}]
ktlint_function_naming_ignore_when_annotated_with = Composable
```

and re-run `ktlintCheck`.

- [ ] **Step 3: Commit**

```bash
git add mobile/build.gradle.kts mobile/.editorconfig
git commit -m "chore(mobile): ktlint with Composable naming exemption"
```

---

### Task 5: Map Interop Spike (expect/actual RouteMap, MapLibre on Android)

**Files:**

- Create: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/map/RouteMap.kt`
- Create: `mobile/composeApp/src/androidMain/kotlin/com/smartroute/traveler/ui/map/RouteMap.android.kt`
- Create: `mobile/composeApp/src/iosMain/kotlin/com/smartroute/traveler/ui/map/RouteMap.ios.kt`
- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/App.kt`

**Interfaces:**

- Consumes: `App()` from Task 2.
- Produces: `@Composable expect fun RouteMap(modifier: Modifier)` in `com.smartroute.traveler.ui.map` — future phases pass route/marker data; the spike renders a map centered on Istanbul (41.0082, 28.9784), zoom 9.

- [ ] **Step 1: Declare the expect composable**

`mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/map/RouteMap.kt`:

```kotlin
package com.smartroute.traveler.ui.map

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Platform-embedded map. Spike scope: render a map centered on Istanbul.
 * Later phases add route polylines and markers as parameters.
 */
@Composable
expect fun RouteMap(modifier: Modifier)
```

- [ ] **Step 2: Android actual via MapLibre + AndroidView**

`mobile/composeApp/src/androidMain/kotlin/com/smartroute/traveler/ui/map/RouteMap.android.kt`:

```kotlin
package com.smartroute.traveler.ui.map

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapView

private const val DEMO_STYLE_URL = "https://demotiles.maplibre.org/style.json"
private val ISTANBUL = LatLng(41.0082, 28.9784)

@Composable
actual fun RouteMap(modifier: Modifier) {
    val context = LocalContext.current
    val mapView = remember {
        MapLibre.getInstance(context)
        MapView(context).apply {
            getMapAsync { map ->
                map.setStyle(DEMO_STYLE_URL)
                map.cameraPosition = CameraPosition.Builder()
                    .target(ISTANBUL)
                    .zoom(9.0)
                    .build()
            }
        }
    }

    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> mapView.onStart()
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                Lifecycle.Event.ON_STOP -> mapView.onStop()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            mapView.onDestroy()
        }
    }

    AndroidView(factory = { mapView }, modifier = modifier)
}
```

- [ ] **Step 3: iOS actual placeholder**

MapLibre iOS requires CocoaPods/SPM integration that needs a Mac — out of scope until Mac access exists (recorded as residual risk). Placeholder keeps the iOS target compiling:

`mobile/composeApp/src/iosMain/kotlin/com/smartroute/traveler/ui/map/RouteMap.ios.kt`:

```kotlin
package com.smartroute.traveler.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

@Composable
actual fun RouteMap(modifier: Modifier) {
    Box(
        modifier = modifier.background(Color(0xFFCCFBF1)),
        contentAlignment = Alignment.Center,
    ) {
        Text("Map — MapLibre iOS integration pending (needs macOS)")
    }
}
```

- [ ] **Step 4: Wire the map into App()**

Replace the full contents of `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/App.kt` with:

```kotlin
package com.smartroute.traveler

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.ui.map.RouteMap

@Composable
fun App() {
    MaterialTheme {
        Column(modifier = Modifier.fillMaxSize().safeDrawingPadding()) {
            Text(
                text = "SmartRoute Traveler",
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.padding(16.dp),
            )
            RouteMap(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
            )
        }
    }
}
```

- [ ] **Step 5: Build and lint**

Run (from `mobile/`):

```powershell
./gradlew ktlintCheck :composeApp:testDebugUnitTest :composeApp:assembleDebug
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Verify on emulator (manual)**

```powershell
./gradlew :composeApp:installDebug
```

Expected on emulator: title "SmartRoute Traveler" at top, world map (MapLibre demo tiles) centered near Istanbul filling the rest of the screen. Panning/zooming works. Ask the user to confirm — this confirmation IS the spike result for Android.

- [ ] **Step 7: Commit**

```bash
git add mobile/composeApp/src
git commit -m "feat(mobile): map spike — expect/actual RouteMap with MapLibre on Android"
```

---

### Task 6: Mobile CI (Android build + iOS framework link on macOS)

**Files:**

- Create: `.github/workflows/mobile-ci.yml`

**Interfaces:**

- Consumes: Gradle tasks from Tasks 2–5 (`ktlintCheck`, `:composeApp:testDebugUnitTest`, `:composeApp:assembleDebug`, `:composeApp:linkDebugFrameworkIosSimulatorArm64`).
- Produces: CI signal that the iOS target compiles — the ONLY iOS verification available while development happens on Windows.

- [ ] **Step 1: Create `.github/workflows/mobile-ci.yml`**

```yaml
name: Mobile CI

on:
  push:
    branches: [main]
    paths: ['mobile/**', '.github/workflows/mobile-ci.yml']
  pull_request:
    paths: ['mobile/**', '.github/workflows/mobile-ci.yml']

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  android:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mobile
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - uses: gradle/actions/setup-gradle@v4

      - name: Lint, test, build (Android)
        run: ./gradlew ktlintCheck :composeApp:testDebugUnitTest :composeApp:assembleDebug

  ios-framework:
    runs-on: macos-latest
    defaults:
      run:
        working-directory: mobile
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - uses: gradle/actions/setup-gradle@v4

      - name: Link iOS framework (compile check)
        run: ./gradlew :composeApp:linkDebugFrameworkIosSimulatorArm64
```

- [ ] **Step 2: Validate YAML locally**

Run (from repo root):

```powershell
npx --yes yaml-lint .github/workflows/mobile-ci.yml
```

Expected: no errors. (If `yaml-lint` is unavailable, any YAML parse via `node -e "require('js-yaml')..."` or careful review suffices — the real validation is the CI run in Step 4.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/mobile-ci.yml
git commit -m "ci: mobile workflow — Android build + iOS framework link on macOS"
```

- [ ] **Step 4: Push and verify CI (with user's approval)**

Ask the user before pushing. Then:

```powershell
git push origin main
gh run watch --repo RyoFallen/smartroute
```

Expected: both `android` and `ios-framework` jobs green. The `ios-framework` job passing is the Phase 1 iOS deliverable. If `ios-framework` fails on Kotlin/Native provisioning, check the error — most common fix is bumping Xcode selection via `maxim-lobanov/setup-xcode` step; add only if needed.

---

## Residual Risks / Deferred (record, don't solve now)

- **iOS on-device validation requires a Mac.** CI proves compilation, not rendering. Options when needed: borrow a Mac, cloud Mac (MacStadium/Scaleway), or university lab machine. Must be resolved before thesis demo if iOS demo is required.
- **iosApp Xcode wrapper** deliberately not created (needs Xcode). First task once Mac access exists.
- **MapLibre iOS actual** is a placeholder. Same Mac dependency.
- **Mapbox vs MapLibre final decision** (spec §8.3): spike ran on MapLibre. Swap = replace `maplibre-android` dependency + imports in `RouteMap.android.kt`; API is a near-identical fork. Decide when map styling matters (Phase 8).
- **`apps/mobile` (Expo) retirement**: delete after the KMP app reaches feature parity for auth+planner (Phase 2–3 of spec).
