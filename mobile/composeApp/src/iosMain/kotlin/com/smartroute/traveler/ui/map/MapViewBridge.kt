package com.smartroute.traveler.ui.map

import platform.UIKit.UIView

/**
 * MapLibre lives in the iosApp Xcode project (SPM), not in this framework — the
 * Swift entry point assigns a factory producing a configured MLNMapView at startup.
 * A null factory (framework-only CI link, previews) falls back to a placeholder.
 */
object MapViewBridge {
    var createMapView: (() -> UIView)? = null
}
