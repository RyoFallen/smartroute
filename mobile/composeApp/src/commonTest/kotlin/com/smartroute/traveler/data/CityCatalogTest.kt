package com.smartroute.traveler.data

import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.ui.map.MapPoint
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

private const val CITIES_JSON = """
[{"iata": "IST", "name": "Istanbul", "country": "Turkiye", "lat": 41.0082, "lon": 28.9784},
 {"iata": "XXX", "name": "Nowhere", "country": "Nowhere"}]
"""

class CityCatalogTest {
    private fun MockRequestHandleScope.json(
        body: String,
        status: HttpStatusCode = HttpStatusCode.OK,
    ): HttpResponseData = respond(body, status, headersOf(HttpHeaders.ContentType, "application/json"))

    private fun catalog(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData) =
        CityCatalog(ApiClient(MockEngine { handler(it) }, "https://api.example.dev") { "jwt" })

    @Test
    fun `caches coordinates after one successful call`() =
        runTest {
            var requests = 0
            val catalog =
                catalog {
                    requests++
                    json(CITIES_JSON)
                }
            val first = catalog.coordinates()
            val second = catalog.coordinates()
            assertEquals(1, requests)
            assertEquals(MapPoint(41.0082, 28.9784), first["IST"])
            assertEquals(first, second)
        }

    @Test
    fun `catalog failure yields empty map and retries next call`() =
        runTest {
            var requests = 0
            val catalog =
                catalog {
                    requests++
                    if (requests == 1) json("{}", HttpStatusCode.InternalServerError) else json(CITIES_JSON)
                }
            assertEquals(emptyMap(), catalog.coordinates())
            assertEquals(MapPoint(41.0082, 28.9784), catalog.coordinates()["IST"])
            assertEquals(2, requests)
        }

    @Test
    fun `skips cities without coordinates`() =
        runTest {
            val coordinates = catalog { json(CITIES_JSON) }.coordinates()
            assertFalse("XXX" in coordinates)
            assertEquals(setOf("IST"), coordinates.keys)
        }
}
