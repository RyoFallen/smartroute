package com.smartroute.traveler.ui.trips

import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.domain.EmptyDayReason
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

private const val ITINERARY_JSON = """
{"tripId": "trip_1", "cities": [
  {"iata": "IST", "name": "Istanbul", "available": true, "days": [
    {"date": "2026-07-01", "dayOfStay": 1, "empty": false, "emptyReason": null, "slots": [
      {"attractionId": "a1", "name": "Hagia Sophia", "category": "RELIGIOUS",
        "lat": 41.0086, "lon": 28.9802, "description": "A former basilica.",
        "startsAt": "2026-07-01T09:00:00+03:00", "endsAt": "2026-07-01T10:00:00+03:00",
        "visitMinutes": 60, "walkMinutesFromPrevious": null,
        "hoursAssumed": false, "closedOnThisDay": false},
      {"attractionId": "a2", "name": "Blue Mosque", "category": "RELIGIOUS",
        "lat": 41.0054, "lon": 28.9768, "description": "An Ottoman mosque.",
        "startsAt": "2026-07-01T10:07:00+03:00", "endsAt": "2026-07-01T10:52:00+03:00",
        "visitMinutes": 45, "walkMinutesFromPrevious": 7,
        "hoursAssumed": true, "closedOnThisDay": false}
    ]},
    {"date": "2026-07-02", "dayOfStay": 2, "empty": true,
      "emptyReason": "DEPARTURE_TOO_EARLY", "slots": []}
  ]},
  {"iata": "JFK", "name": null, "available": false, "days": []}
]}
"""

@OptIn(ExperimentalCoroutinesApi::class)
class ItineraryViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun MockRequestHandleScope.json(
        body: String,
        status: HttpStatusCode = HttpStatusCode.OK,
    ): HttpResponseData = respond(body, status, headersOf(HttpHeaders.ContentType, "application/json"))

    private fun viewModel(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData): ItineraryViewModel =
        ItineraryViewModel(
            ApiClient(MockEngine { handler(it) }, "https://api.example.dev") { "jwt" },
            "trip_1",
        )

    private suspend fun loaded(json: String = ITINERARY_JSON): ItineraryUiState.Loaded {
        val vm = viewModel { json(json) }
        vm.load()
        return vm.state.first { it is ItineraryUiState.Loaded } as ItineraryUiState.Loaded
    }

    @Test
    fun `load exposes cities in visiting order with their days`() =
        runTest(dispatcher) {
            val state = loaded()

            assertEquals(listOf("IST", "JFK"), state.cities.map { it.iata })
            assertEquals("Istanbul", state.cities[0].name)
            assertEquals(listOf("2026-07-01", "2026-07-02"), state.cities[0].days.map { it.date })
            assertEquals(listOf(1, 2), state.cities[0].days.map { it.dayOfStay })
        }

    @Test
    fun `slots keep their order, times and walking gaps`() =
        runTest(dispatcher) {
            val slots = loaded().cities[0].days[0].slots

            assertEquals(listOf("Hagia Sophia", "Blue Mosque"), slots.map { it.name })
            assertEquals("2026-07-01T09:00:00+03:00", slots[0].startsAt)
            assertEquals(60, slots[0].visitMinutes)
            assertNull(slots[0].walkMinutesFromPrevious)
            assertEquals(7, slots[1].walkMinutesFromPrevious)
        }

    @Test
    fun `honesty flags survive to the UI`() =
        runTest(dispatcher) {
            val slots = loaded().cities[0].days[0].slots

            assertFalse(slots[0].hoursAssumed)
            assertTrue(slots[1].hoursAssumed)
            assertFalse(slots[1].closedOnThisDay)
        }

    @Test
    fun `an empty day carries its reason`() =
        runTest(dispatcher) {
            val day = loaded().cities[0].days[1]

            assertTrue(day.empty)
            assertTrue(day.slots.isEmpty())
            assertEquals(EmptyDayReason.DEPARTURE_TOO_EARLY, day.reason)
        }

    @Test
    fun `an unrecognized empty reason degrades instead of failing the load`() =
        runTest(dispatcher) {
            val state = loaded(ITINERARY_JSON.replace("DEPARTURE_TOO_EARLY", "SOMETHING_NEW"))

            assertEquals(EmptyDayReason.UNKNOWN, state.cities[0].days[1].reason)
        }

    @Test
    fun `a city with no attraction data is unavailable, not missing`() =
        runTest(dispatcher) {
            val jfk = loaded().cities[1]

            assertFalse(jfk.available)
            assertNull(jfk.name)
            assertTrue(jfk.days.isEmpty())
        }

    @Test
    fun `load failure shows retry state and retry recovers`() =
        runTest(dispatcher) {
            var fail = true
            val vm =
                viewModel {
                    if (fail) json("""{"error":{}}""", HttpStatusCode.InternalServerError) else json(ITINERARY_JSON)
                }
            vm.load()
            vm.state.first { it is ItineraryUiState.LoadFailed }

            fail = false
            vm.load()
            vm.state.first { it is ItineraryUiState.Loaded }
        }
}
