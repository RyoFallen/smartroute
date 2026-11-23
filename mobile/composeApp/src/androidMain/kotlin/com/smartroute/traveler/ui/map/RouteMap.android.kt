package com.smartroute.traveler.ui.map

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapView

private const val DEMO_STYLE_URL = "https://demotiles.maplibre.org/style.json"
private val ISTANBUL = LatLng(41.0082, 28.9784)

@Composable
actual fun RouteMap(
    state: RouteMapState,
    modifier: Modifier,
) {
    val context = LocalContext.current
    val mapView =
        remember {
            MapLibre.getInstance(context)
            MapView(context).apply {
                // MapView contract: forward onCreate; no saved state at construction
                onCreate(null)
                getMapAsync { map ->
                    map.setStyle(DEMO_STYLE_URL)
                    map.cameraPosition =
                        CameraPosition
                            .Builder()
                            .target(ISTANBUL)
                            .zoom(9.0)
                            .build()
                }
            }
        }

    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val observer =
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_START -> mapView.onStart()
                    Lifecycle.Event.ON_RESUME -> mapView.onResume()
                    Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                    Lifecycle.Event.ON_STOP -> mapView.onStop()
                    else -> Unit
                }
            }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            mapView.onDestroy()
        }
    }

    AndroidView(factory = { mapView }, modifier = modifier)
}
