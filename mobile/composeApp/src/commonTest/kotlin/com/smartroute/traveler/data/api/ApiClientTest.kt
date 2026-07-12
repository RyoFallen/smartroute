package com.smartroute.traveler.data.api

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

private const val BASE = "http://localhost:3000"

private const val TRIPS_JSON = """
[{"id": "trip_1", "name": "Balkans", "startDate": "2026-08-01", "endDate": "2026-08-10",
  "cabinClass": "economy", "travelers": 1, "cities": ["SOF", "BEG", "TIA"],
  "flights": [], "totalPriceCents": 84700,
  "createdAt": "2026-07-12T00:00:00Z", "updatedAt": "2026-07-12T00:00:00Z"}]
"""

class ApiClientTest {
    @Test
    fun `attaches bearer token and parses trips`() =
        runTest {
            var tokenCalls = 0
            val engine =
                MockEngine { request ->
                    assertEquals("Bearer session-jwt", request.headers[HttpHeaders.Authorization])
                    assertEquals("/trips", request.url.encodedPath)
                    respond(TRIPS_JSON, HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
                }
            val api =
                ApiClient(engine, BASE) {
                    tokenCalls++
                    "session-jwt"
                }

            val trips = api.getTrips()

            assertEquals(1, tokenCalls)
            assertEquals(listOf("SOF", "BEG", "TIA"), trips.single().cities)
            assertEquals(84700L, trips.single().totalPriceCents)
        }

    @Test
    fun `refreshes token and retries once on 401`() =
        runTest {
            var tokenCalls = 0
            var requests = 0
            val engine =
                MockEngine { request ->
                    requests++
                    if (request.headers[HttpHeaders.Authorization] == "Bearer fresh-jwt") {
                        respond(TRIPS_JSON, HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
                    } else {
                        respond(
                            """{"error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}""",
                            HttpStatusCode.Unauthorized,
                            headersOf(HttpHeaders.ContentType, "application/json"),
                        )
                    }
                }
            val api =
                ApiClient(engine, BASE) {
                    tokenCalls++
                    if (tokenCalls == 1) "stale-jwt" else "fresh-jwt"
                }

            val trips = api.getTrips()

            assertEquals(2, tokenCalls)
            assertEquals(2, requests)
            assertEquals("trip_1", trips.single().id)
        }

    @Test
    fun `maps backend error envelope to ApiError`() =
        runTest {
            val engine =
                MockEngine {
                    respond(
                        """{"error": {"code": "NOT_FOUND", "message": "Trip not found"}}""",
                        HttpStatusCode.NotFound,
                        headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }
            val api = ApiClient(engine, BASE) { "session-jwt" }

            val error = assertFailsWith<ApiError> { api.getTrips() }
            assertEquals("NOT_FOUND", error.code)
            assertEquals("Trip not found", error.message)
            assertEquals(404, error.status)
        }
}
