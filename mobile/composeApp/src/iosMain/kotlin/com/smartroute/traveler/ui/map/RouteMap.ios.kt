package com.smartroute.traveler.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.UIKitView

@Composable
actual fun RouteMap(modifier: Modifier) {
    val createMapView = MapViewBridge.createMapView
    if (createMapView != null) {
        UIKitView(
            factory = createMapView,
            modifier = modifier,
        )
    } else {
        Box(
            modifier = modifier.background(Color(0xFFCCFBF1)),
            contentAlignment = Alignment.Center,
        ) {
            Text("Map unavailable — no MapViewBridge factory registered")
        }
    }
}
