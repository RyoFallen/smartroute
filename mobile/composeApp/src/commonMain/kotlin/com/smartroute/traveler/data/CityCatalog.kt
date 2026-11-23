package com.smartroute.traveler.data

import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.ui.map.MapPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * City coordinates by IATA code, fetched once from `/cities`. A failure yields an
 * empty map and is not cached, so the next call retries.
 */
class CityCatalog(
    private val api: ApiClient,
) {
    private val mutex = Mutex()
    private var cached: Map<String, MapPoint>? = null

    suspend fun coordinates(): Map<String, MapPoint> =
        mutex.withLock {
            cached ?: load()?.also { cached = it } ?: emptyMap()
        }

    private suspend fun load(): Map<String, MapPoint>? =
        try {
            api
                .getCities()
                .mapNotNull { city ->
                    val lat = city.lat
                    val lon = city.lon
                    if (lat != null && lon != null) city.iata to MapPoint(lat, lon) else null
                }.toMap()
        } catch (e: CancellationException) {
            throw e
        } catch (
            @Suppress("TooGenericExceptionCaught") e: Exception,
        ) {
            null
        }
}
