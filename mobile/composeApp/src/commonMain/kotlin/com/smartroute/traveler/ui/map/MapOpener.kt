package com.smartroute.traveler.ui.map

import androidx.compose.runtime.Composable

/** Opens a location in the device's native maps app. */
@Composable
expect fun rememberMapOpener(): (lat: Double, lon: Double, label: String) -> Unit
