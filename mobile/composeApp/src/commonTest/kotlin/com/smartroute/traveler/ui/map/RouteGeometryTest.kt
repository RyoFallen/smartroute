package com.smartroute.traveler.ui.map

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RouteGeometryTest {
    @Test
    fun `boundsOf empty is null`() = assertNull(boundsOf(emptyList()))

    @Test
    fun `boundsOf single point is padded to the minimum span`() {
        val b = assertNotNull(boundsOf(listOf(MapPoint(41.0, 29.0))))
        assertEquals(0.2, b.north - b.south, 1e-9)
        assertEquals(0.2, b.east - b.west, 1e-9)
        assertEquals(41.0, (b.north + b.south) / 2, 1e-9)
        assertEquals(29.0, (b.east + b.west) / 2, 1e-9)
    }

    @Test
    fun `boundsOf spans all points`() =
        assertEquals(
            MapBounds(41.9, 2.1, 52.5, 13.4),
            boundsOf(listOf(MapPoint(52.5, 13.4), MapPoint(41.9, 12.5), MapPoint(48.8, 2.1))),
        )

    @Test
    fun `polylinePrefix at half of a two-segment equal-length line ends at the middle vertex`() =
        assertEquals(
            listOf(MapPoint(0.0, 0.0), MapPoint(0.0, 1.0)),
            polylinePrefix(listOf(MapPoint(0.0, 0.0), MapPoint(0.0, 1.0), MapPoint(0.0, 2.0)), 0.5f),
        )

    @Test
    fun `polylinePrefix interpolates inside a segment`() =
        assertEquals(
            MapPoint(0.0, 0.25),
            polylinePrefix(listOf(MapPoint(0.0, 0.0), MapPoint(0.0, 1.0)), 0.25f).last(),
        )

    @Test
    fun `polylinePrefix clamps`() {
        val line = listOf(MapPoint(0.0, 0.0), MapPoint(0.0, 1.0), MapPoint(0.0, 2.0))
        assertEquals(listOf(MapPoint(0.0, 0.0)), polylinePrefix(line, -1f))
        assertEquals(line, polylinePrefix(line, 2f))
    }

    @Test
    fun `routePoints skips cities without coordinates`() =
        assertEquals(
            listOf(MapPoint(52.5, 13.4)),
            routePoints(listOf("BER", "XXX"), mapOf("BER" to MapPoint(52.5, 13.4))),
        )

    @Test
    fun `RouteMapState isEmpty`() = assertTrue(RouteMapState(emptyList()).isEmpty)
}
