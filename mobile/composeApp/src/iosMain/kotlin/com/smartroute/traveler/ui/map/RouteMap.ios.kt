package com.smartroute.traveler.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.smartroute.traveler.ui.theme.SrColors

/**
 * iOS draws no route yet: the MapLibre bridge is route-less and its demotiles
 * look wrong inside cards, so a muted placeholder keeps the card layout and
 * nothing is shown when there is no route.
 */
@Composable
actual fun RouteMap(
    state: RouteMapState,
    modifier: Modifier,
) {
    if (state.isEmpty) return
    Box(modifier = modifier.background(SrColors.Muted))
}
