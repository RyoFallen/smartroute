# ADR-0001: MapLibre iOS via Swift-side view injection (not CocoaPods cinterop)

**Status:** accepted (2026-07-12)

## Context

`RouteMap` is `expect`/`actual`. Android's actual uses the MapLibre Android SDK
directly from Kotlin. For iOS, MapLibre ships as a Swift package
(`maplibre-gl-native-distribution`); consuming it from Kotlin would require the
Kotlin CocoaPods plugin (cinterop) — adding CocoaPods to the toolchain, a
`pod install` step, and changes to how CI links the framework.

## Decision

MapLibre iOS is a dependency of the `iosApp` Xcode wrapper only (SPM). The
Kotlin framework exposes a `MapViewBridge.createMapView: (() -> UIView)?` hook;
the Swift entry point registers a factory producing a configured `MLNMapView`
at startup, and `RouteMap.ios.kt` embeds it via Compose `UIKitView`. The Kotlin
build stays MapLibre-free on iOS, so `:composeApp:linkDebugFrameworkIos*` (the
CI compile check) is unaffected.

## Consequences

- CI, Windows-machine builds, and the Gradle setup need no CocoaPods/Xcode
  coupling; the wrapper is the only place that knows about MapLibre iOS.
- Map behaviour parity (style URL, camera) is duplicated in Swift
  (`MapViewFactory.swift`) rather than shared — acceptable while the map is
  display-only.
- When routes/markers arrive (planner phases), evolve `RouteMap` toward a
  common state-holder parameter (per `AGENTS.md`) and widen the bridge to a
  Kotlin interface implemented in Swift (e.g. `setCamera`, `setPolyline`),
  keeping map _state_ in commonMain and map _rendering_ in each platform's SDK.
- A Mapbox swap (spec §8.3) remains a per-platform dependency + factory change.
