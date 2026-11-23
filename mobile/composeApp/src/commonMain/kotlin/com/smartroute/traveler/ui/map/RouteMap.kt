package com.smartroute.traveler.ui.map

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Platform-embedded map. Renders [state]'s route; evolve through the state holder, not positional params.
 */
@Composable
expect fun RouteMap(
    state: RouteMapState,
    modifier: Modifier = Modifier,
)
