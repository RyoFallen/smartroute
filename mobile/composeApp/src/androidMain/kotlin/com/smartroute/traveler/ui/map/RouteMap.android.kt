package com.smartroute.traveler.ui.map

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.doOnLayout
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.smartroute.traveler.ui.theme.SrColors
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.LineString
import org.maplibre.geojson.Point

private const val STYLE_URL = "https://tiles.openfreemap.org/styles/positron"
private const val ROUTE_SOURCE = "route"
private const val STOPS_SOURCE = "stops"
private const val FIT_PADDING_DP = 28
private const val DRAW_IN_MS = 300

// Compose's EaseOut curve, spelled out.
private val EaseOut = CubicBezierEasing(0f, 0f, 0.58f, 1f)

private fun routeCollection(points: List<MapPoint>): FeatureCollection =
    if (points.size < 2) {
        FeatureCollection.fromFeatures(emptyList<Feature>())
    } else {
        FeatureCollection.fromFeature(
            Feature.fromGeometry(LineString.fromLngLats(points.map { Point.fromLngLat(it.lon, it.lat) })),
        )
    }

private fun stopsCollection(points: List<MapPoint>): FeatureCollection =
    FeatureCollection.fromFeatures(points.map { Feature.fromGeometry(Point.fromLngLat(it.lon, it.lat)) })

private fun Style.setRoute(points: List<MapPoint>) {
    getSourceAs<GeoJsonSource>(ROUTE_SOURCE)?.setGeoJson(routeCollection(points))
}

@Composable
actual fun RouteMap(
    state: RouteMapState,
    modifier: Modifier,
) {
    if (state.isEmpty) return

    val context = LocalContext.current
    val paddingPx = with(LocalDensity.current) { FIT_PADDING_DP.dp.roundToPx() }
    var map by remember { mutableStateOf<MapLibreMap?>(null) }
    var style by remember { mutableStateOf<Style?>(null) }

    val mapView =
        remember {
            MapLibre.getInstance(context)
            MapView(context).apply {
                // MapView contract: forward onCreate; no saved state at construction
                onCreate(null)
                getMapAsync { m ->
                    m.uiSettings.setAllGesturesEnabled(false)
                    m.setStyle(STYLE_URL) { loaded ->
                        val primary = SrColors.Primary.toArgb()
                        loaded.addSource(GeoJsonSource(ROUTE_SOURCE, routeCollection(emptyList())))
                        loaded.addLayer(
                            LineLayer("route-line", ROUTE_SOURCE).withProperties(
                                PropertyFactory.lineColor(primary),
                                PropertyFactory.lineWidth(3.5f),
                                PropertyFactory.lineCap(Property.LINE_CAP_ROUND),
                                PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
                            ),
                        )
                        loaded.addSource(GeoJsonSource(STOPS_SOURCE, stopsCollection(emptyList())))
                        loaded.addLayer(
                            CircleLayer("stops-dot", STOPS_SOURCE).withProperties(
                                PropertyFactory.circleRadius(5f),
                                PropertyFactory.circleColor(android.graphics.Color.WHITE),
                                PropertyFactory.circleStrokeColor(primary),
                                PropertyFactory.circleStrokeWidth(2.5f),
                            ),
                        )
                        map = m
                        style = loaded
                    }
                }
            }
        }

    // Stops and camera: once per change of points, after the style exists and the view has a size.
    LaunchedEffect(style, state.points, paddingPx) {
        val m = map ?: return@LaunchedEffect
        val s = style ?: return@LaunchedEffect
        s.getSourceAs<GeoJsonSource>(STOPS_SOURCE)?.setGeoJson(stopsCollection(state.points))
        val b = boundsOf(state.points) ?: return@LaunchedEffect
        val bounds = LatLngBounds.from(b.north, b.east, b.south, b.west)
        mapView.doOnLayout {
            m.moveCamera(CameraUpdateFactory.newLatLngBounds(bounds, paddingPx))
        }
    }

    // Draw-in: each frame pushes a longer prefix of the polyline into the route source.
    LaunchedEffect(style, state.points, state.animate) {
        val s = style ?: return@LaunchedEffect
        if (!state.animate) {
            s.setRoute(state.points)
            return@LaunchedEffect
        }
        Animatable(0f).animateTo(1f, tween(DRAW_IN_MS, easing = EaseOut)) {
            s.setRoute(polylinePrefix(state.points, value))
        }
        s.setRoute(state.points)
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
