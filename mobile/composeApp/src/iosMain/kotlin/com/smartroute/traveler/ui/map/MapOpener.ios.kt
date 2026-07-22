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
        if (url != null) UIApplication.sharedApplication.openURL(url)
    }
