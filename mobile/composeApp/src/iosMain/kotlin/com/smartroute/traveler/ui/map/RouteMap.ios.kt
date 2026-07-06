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
