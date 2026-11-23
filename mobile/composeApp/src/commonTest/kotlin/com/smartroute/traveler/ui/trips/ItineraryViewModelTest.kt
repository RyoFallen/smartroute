package com.smartroute.traveler.ui.trips

import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.ItineraryCityDto
import com.smartroute.traveler.data.api.ItineraryDayDto
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

/** A conflict no arrangement could avoid, and a day left clear to make room (#30). */
private const val CLOSURE_JSON = """
{"tripId": "trip_1", "cities": [
  {"iata": "IST", "name": "Istanbul", "available": true, "days": [
    {"date": "2026-07-01", "dayOfStay": 1, "empty": false, "emptyReason": null, "slots": [
      {"attractionId": "a3", "name": "Topkapi Palace", "category": "HISTORICAL",
        "lat": 41.0115, "lon": 28.9833, "description": "An Ottoman palace.",
        "startsAt": "2026-07-01T09:00:00+03:00", "endsAt": "2026-07-01T10:00:00+03:00",
        "visitMinutes": 60, "walkMinutesFromPrevious": null,
        "hoursAssumed": false, "closedOnThisDay": true}
    ]},
    {"date": "2026-07-02", "dayOfStay": 2, "empty": true,
      "emptyReason": "SCHEDULED_AROUND_CLOSURES", "slots": []}
  ]}
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
    fun `an opening time the backend had to guess reaches the UI`() =
        runTest(dispatcher) {
            // ItineraryScreen badges exactly this flag (#31). It is behaviour,
            // not decoration: a slot that silently loses it turns a disclosed
            // approximation into an undisclosed one, and the traveler can no
            // longer tell an opening time we know from one we guessed. The two
            // slots differ only in the flag, so a view model that dropped it
            // would still return two slots and still fail here.
            val slots = loaded().cities[0].days[0].slots

            assertFalse(slots[0].hoursAssumed)
            assertTrue(slots[1].hoursAssumed)
            assertFalse(slots[1].closedOnThisDay)
        }

    @Test
    fun `a closure the backend could not design away reaches the UI`() =
        runTest(dispatcher) {
            // ItineraryScreen badges exactly this flag, and a day left clear to
            // make room carries its own reason. Both are #30's disclosure, and a
            // slot that silently loses the flag sends someone to a locked door.
            val city = loaded(CLOSURE_JSON).cities[0]

            assertTrue(city.days[0].slots[0].closedOnThisDay)
            assertEquals(EmptyDayReason.SCHEDULED_AROUND_CLOSURES, city.days[1].reason)
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

    private fun day(n: Int) = ItineraryDayDto(date = "2026-07-0$n", dayOfStay = n, empty = false)

    @Test
    fun `dayTabs numbers days across cities`() {
        val tabs =
            dayTabs(
                listOf(
                    ItineraryCityDto("AAA", "A", true, listOf(day(1), day(2))),
                    ItineraryCityDto("BBB", "B", true, listOf(day(1))),
                ),
            )

        assertEquals(listOf(1, 2, 3), tabs.map { it.number })
        assertEquals(listOf("A", "A", "B"), tabs.map { it.cityName })
        assertEquals(listOf("AAA", "AAA", "BBB"), tabs.map { it.iata })
    }

    @Test
    fun `an unavailable city gets one tab without a day`() {
        val tabs =
            dayTabs(
                listOf(
                    ItineraryCityDto("AAA", "A", true, listOf(day(1))),
                    ItineraryCityDto("JFK", null, false, emptyList()),
                ),
            )

        assertEquals(2, tabs.size)
        assertEquals(2, tabs[1].number)
        assertNull(tabs[1].day)
        assertNull(tabs[1].cityName)
    }

    @Test
    fun `empty days keep their tab`() =
        runTest(dispatcher) {
            val tab = loaded().tabs[1]

            assertTrue(tab.day!!.empty)
            assertEquals(EmptyDayReason.DEPARTURE_TOO_EARLY, tab.day!!.reason)
        }

    @Test
    fun `selectTab changes the selection and ignores out of range`() =
        runTest(dispatcher) {
            val vm = viewModel { json(ITINERARY_JSON) }
            vm.load()
            vm.state.first { it is ItineraryUiState.Loaded }

            vm.selectTab(2)
            assertEquals(2, (vm.state.value as ItineraryUiState.Loaded).selectedTab)
            vm.selectTab(3)
            vm.selectTab(-1)
            assertEquals(2, (vm.state.value as ItineraryUiState.Loaded).selectedTab)
        }

    @Test
    fun `a reload keeps the selected tab`() =
        runTest(dispatcher) {
            val vm = viewModel { json(ITINERARY_JSON) }
            vm.load()
            vm.state.first { it is ItineraryUiState.Loaded }
            vm.selectTab(2)

            vm.load()
            vm.state.first { it is ItineraryUiState.Loaded }

            assertEquals(2, (vm.state.value as ItineraryUiState.Loaded).selectedTab)
        }

    @Test
    fun `a reload with fewer tabs clamps the selection`() =
        runTest(dispatcher) {
            var body = ITINERARY_JSON
            val vm = viewModel { json(body) }
            vm.load()
            vm.state.first { it is ItineraryUiState.Loaded }
            vm.selectTab(2)

            // Only the unavailable city remains: one tab.
            body = """{"tripId": "trip_1", "cities": [{"iata": "JFK", "name": null, "available": false, "days": []}]}"""
            vm.load()
            vm.state.first { it is ItineraryUiState.Loaded }

            assertEquals(0, (vm.state.value as ItineraryUiState.Loaded).selectedTab)
        }
}
