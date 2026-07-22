package com.smartroute.traveler.ui.map

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

@Composable
actual fun rememberMapOpener(): (lat: Double, lon: Double, label: String) -> Unit {
    val context = LocalContext.current
    return { lat, lon, label ->
        val uri = Uri.parse("geo:$lat,$lon?q=${Uri.encode(label)}")
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            // No app can resolve a geo: intent — silently no-op, matching the iOS actual's
            // behavior when NSURLComponents fails to build a URL.
        }
    }
}
