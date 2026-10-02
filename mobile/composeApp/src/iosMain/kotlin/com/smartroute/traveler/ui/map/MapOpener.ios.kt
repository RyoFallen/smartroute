package com.smartroute.traveler.ui.map

import androidx.compose.runtime.Composable
import platform.Foundation.NSURLComponents
import platform.Foundation.NSURLQueryItem
import platform.UIKit.UIApplication

@Composable
actual fun rememberMapOpener(): (lat: Double, lon: Double, label: String) -> Unit =
    { lat, lon, label ->
        val components = NSURLComponents(string = "http://maps.apple.com/")
        components.queryItems =
            listOf(
                NSURLQueryItem(name = "ll", value = "$lat,$lon"),
                NSURLQueryItem(name = "q", value = label),
            )
        val url = components.URL
        // The options/completionHandler overload, never the one-argument
        // `openURL(_:)`: current iOS (observed on 26.5) force-returns false for the
        // deprecated form, so the tap silently does nothing (#32).
        if (url != null) {
            UIApplication.sharedApplication.openURL(url, options = emptyMap<Any?, Any>(), completionHandler = null)
        }
    }
