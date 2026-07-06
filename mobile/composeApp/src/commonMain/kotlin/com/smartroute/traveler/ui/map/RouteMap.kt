package com.smartroute.traveler.ui.map

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Platform-embedded map. Spike scope: render a map centered on Istanbul.
 * Later phases add route polylines and markers as parameters.
 */
@Composable
expect fun RouteMap(modifier: Modifier)
