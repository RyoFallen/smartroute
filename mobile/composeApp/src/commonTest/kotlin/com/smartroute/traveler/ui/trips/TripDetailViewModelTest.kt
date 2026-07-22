package com.smartroute.traveler.ui.trips

import com.smartroute.traveler.data.api.ApiClient
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

@OptIn(ExperimentalCoroutinesApi::class)
class TripDetailViewModelTest {
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

    private fun viewModel(
        tripId: String = "trip_1",
        handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData,
    ): TripDetailViewModel =
        TripDetailViewModel(
            ApiClient(MockEngine { handler(it) }, "https://api.example.dev") { "jwt" },
            tripId,
        )

    @Test
    fun `load renders the trip detail`() =
        runTest(dispatcher) {
            val vm = viewModel { json(TRIP_DETAIL_JSON) }
            vm.load()
            val state = vm.state.first { it is TripDetailUiState.Loaded } as TripDetailUiState.Loaded
            assertEquals("Balkans", state.trip.name)
            assertEquals(1, state.trip.flights.size)
        }

    @Test
    fun `requests the given trip id`() =
        runTest(dispatcher) {
            var requestedPath: String? = null
            val vm =
                viewModel(tripId = "trip_42") { request ->
                    requestedPath = request.url.encodedPath
                    json(TRIP_DETAIL_JSON)
                }
            vm.load()
            vm.state.first { it is TripDetailUiState.Loaded }
            assertEquals("/trips/trip_42", requestedPath)
        }

    @Test
    fun `load failure shows retry state and retry recovers`() =
        runTest(dispatcher) {
            var fail = true
            val vm =
                viewModel {
                    if (fail) json("""{"error":{}}""", HttpStatusCode.InternalServerError) else json(TRIP_DETAIL_JSON)
                }
            vm.load()
            vm.state.first { it is TripDetailUiState.LoadFailed }

            fail = false
            vm.load()
            vm.state.first { it is TripDetailUiState.Loaded }
        }
}
