package com.smartroute.traveler.data.api

import com.smartroute.traveler.domain.AttractionCategory
import com.smartroute.traveler.domain.OptimizePreset
import com.smartroute.traveler.domain.RouteLabel
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
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

private const val TRIP_DETAIL_JSON = """
{"id": "trip_1", "name": "Balkans", "startDate": "2026-08-01T00:00:00.000Z",
  "endDate": "2026-08-10T00:00:00.000Z", "cabinClass": "ECONOMY", "travelers": 1,
  "cities": ["SOF", "BEG", "TIA"],
  "flights": [{"origin": "SOF", "destination": "BEG",
    "depart": "2026-08-01T08:00:00.000Z", "arrive": "2026-08-01T09:30:00.000Z",
    "carrier": "XX", "priceCents": 42350, "durationMin": 90, "stops": 0}],
  "totalPriceCents": 84700,
  "createdAt": "2026-07-12T00:00:00Z", "updatedAt": "2026-07-12T00:00:00Z"}
"""

private const val TRIP_PLAN_JSON = """
{"tripId": "trip_1", "cities": [
  {"iata": "SOF", "name": "Sofia", "available": true, "mustGo": [
    {"id": "a1", "name": "Alexander Nevsky Cathedral", "category": "RELIGIOUS",
      "rank": 1, "lat": 42.6957, "lon": 23.3327, "description": "A neo-Byzantine cathedral."}
  ]},
  {"iata": "BEG", "name": null, "available": false, "mustGo": []}
]}
"""

private const val CITIES_JSON = """
[{"iata": "SOF", "name": "Sofia", "country": "Bulgaria"},
 {"iata": "BEG", "name": "Belgrade", "country": "Serbia"}]
"""

private const val OPTIMIZE_RESPONSE_JSON = """
{"options": [
  {"label": "recommended", "order": ["SOF", "BEG"], "flights": [],
    "totalPriceCents": 84700, "totalDurationMin": 180}
]}
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

    @Test
    fun `fetches a single trip with its flight legs`() =
        runTest {
            val engine =
                MockEngine { request ->
                    assertEquals("/trips/trip_1", request.url.encodedPath)
                    respond(TRIP_DETAIL_JSON, HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
                }
            val api = ApiClient(engine, BASE) { "session-jwt" }

            val trip = api.getTrip("trip_1")

            assertEquals("Balkans", trip.name)
            assertEquals("ECONOMY", trip.cabinClass)
            assertEquals(1, trip.flights.size)
            assertEquals("SOF", trip.flights.single().origin)
            assertEquals(42350L, trip.flights.single().priceCents)
        }

    @Test
    fun `fetches a trip plan with per-city availability`() =
        runTest {
            val engine =
                MockEngine { request ->
                    assertEquals("/trips/trip_1/plan", request.url.encodedPath)
                    respond(TRIP_PLAN_JSON, HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
                }
            val api = ApiClient(engine, BASE) { "session-jwt" }

            val plan = api.getTripPlan("trip_1")

            val sofia = plan.cities[0]
            assertEquals(2, plan.cities.size)
            assertEquals("Sofia", sofia.name)
            assertEquals(1, sofia.mustGo.size)
            assertEquals(AttractionCategory.RELIGIOUS, sofia.mustGo.single().category)
            assertEquals(false, plan.cities[1].available)
        }

    @Test
    fun `fetches curated cities`() =
        runTest {
            val engine =
                MockEngine { request ->
                    assertEquals("/cities", request.url.encodedPath)
                    respond(CITIES_JSON, HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
                }
            val api = ApiClient(engine, BASE) { "session-jwt" }

            val cities = api.getCities()

            assertEquals(2, cities.size)
            assertEquals("Sofia", cities.first().name)
        }

    @Test
    fun `posts an optimize request and parses the response`() =
        runTest {
            val requestJson = Json { ignoreUnknownKeys = true }
            var sentBody: HttpRequestData? = null
            val engine =
                MockEngine { request ->
                    assertEquals("/optimize", request.url.encodedPath)
                    sentBody = request
                    respond(
                        OPTIMIZE_RESPONSE_JSON,
                        HttpStatusCode.OK,
                        headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }
            val api = ApiClient(engine, BASE) { "session-jwt" }
            val request =
                OptimizeRequestDto(
                    cities = listOf("SOF", "BEG"),
                    departDate = "2026-08-01",
                    perCityDays = listOf(2, 3),
                    travelers = 1,
                    cabinClass = "ECONOMY",
                    directOnly = false,
                    preset = OptimizePreset.BALANCED,
                )

            val response = api.optimize(request)

            assertEquals(1, response.options.size)
            assertEquals(RouteLabel.RECOMMENDED, response.options.single().label)
            val decoded = requestJson.decodeFromString<OptimizeRequestDto>(sentBody!!.body.toByteArray().decodeToString())
            assertEquals(request, decoded)
        }
}
