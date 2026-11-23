package com.smartroute.traveler.ui.map

import kotlin.math.hypot

data class MapPoint(
    val lat: Double,
    val lon: Double,
)

data class MapBounds(
    val south: Double,
    val west: Double,
    val north: Double,
    val east: Double,
)

/** What a route map shows: the polyline through [points], drawn in with an animation when [animate]. */
data class RouteMapState(
    val points: List<MapPoint>,
    val animate: Boolean = true,
) {
    val isEmpty: Boolean get() = points.isEmpty()
}

/**
 * Bounding box of [points], or null for none. A single point, or any span below
 * [minSpanDegrees], is padded symmetrically so the camera never zooms to street
 * level or out to the whole world.
 */
fun boundsOf(
    points: List<MapPoint>,
    minSpanDegrees: Double = 0.2,
): MapBounds? {
    if (points.isEmpty()) return null
    val (south, north) = padded(points.minOf { it.lat }, points.maxOf { it.lat }, minSpanDegrees)
    val (west, east) = padded(points.minOf { it.lon }, points.maxOf { it.lon }, minSpanDegrees)
    return MapBounds(south, west, north, east)
}

private fun padded(
    min: Double,
    max: Double,
    minSpan: Double,
): Pair<Double, Double> {
    if (max - min >= minSpan) return min to max
    val mid = (min + max) / 2
    return (mid - minSpan / 2) to (mid + minSpan / 2)
}

/**
 * The polyline cut at [fraction] of its total length (straight-line interpolation
 * in lat/lon). `fraction <= 0` gives the first point only, `>= 1` all points.
 */
fun polylinePrefix(
    points: List<MapPoint>,
    fraction: Float,
): List<MapPoint> {
    if (points.size < 2) return points
    if (fraction >= 1f) return points
    if (fraction <= 0f) return listOf(points.first())

    val lengths = points.zipWithNext { a, b -> hypot(b.lat - a.lat, b.lon - a.lon) }
    val total = lengths.sum()
    if (total == 0.0) return listOf(points.first())

    var remaining = total * fraction
    val result = mutableListOf(points.first())
    for (i in lengths.indices) {
        val len = lengths[i]
        if (remaining <= 0.0) break
        if (remaining >= len) {
            result += points[i + 1]
            remaining -= len
        } else {
            val t = remaining / len
            val a = points[i]
            val b = points[i + 1]
            result += MapPoint(a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t)
            break
        }
    }
    return result
}

/** Maps city codes in order to their coordinates, skipping codes that have none. */
fun routePoints(
    order: List<String>,
    coordinates: Map<String, MapPoint>,
): List<MapPoint> = order.mapNotNull { coordinates[it] }
