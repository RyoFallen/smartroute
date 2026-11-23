package com.smartroute.traveler.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.UIKitView
import com.smartroute.traveler.ui.theme.SrColors

@Composable
actual fun RouteMap(
    state: RouteMapState,
    modifier: Modifier,
) {
    val createMapView = MapViewBridge.createMapView
    if (createMapView != null) {
        UIKitView(
            factory = createMapView,
            modifier = modifier,
        )
    } else {
        Box(
            modifier = modifier.background(SrColors.Muted),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Map unavailable — no MapViewBridge factory registered",
                color = SrColors.MutedForeground,
            )
        }
    }
}
