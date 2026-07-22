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
import kotlin.test.assertTrue

private const val TRIPS_JSON = """
[{"id": "trip_1", "name": "Balkans", "startDate": "2026-08-01", "endDate": "2026-08-10",
  "cabinClass": "ECONOMY", "travelers": 1, "cities": ["SOF", "BEG", "TIA"],
  "flights": [], "totalPriceCents": 84700,
  "createdAt": "2026-07-12T00:00:00Z", "updatedAt": "2026-07-12T00:00:00Z"}]
"""

@OptIn(ExperimentalCoroutinesApi::class)
class TripsListViewModelTest {
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

    private fun viewModel(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData): TripsListViewModel =
        TripsListViewModel(
            ApiClient(MockEngine { handler(it) }, "https://api.example.dev") { "jwt" },
        )

    @Test
    fun `load renders the saved trips`() =
        runTest(dispatcher) {
            val vm = viewModel { json(TRIPS_JSON) }
            vm.load()
            val state = vm.state.first { it is TripsListUiState.Loaded } as TripsListUiState.Loaded
            assertEquals(1, state.trips.size)
            assertEquals("Balkans", state.trips.first().name)
        }

    @Test
    fun `load with no saved trips renders an empty list`() =
        runTest(dispatcher) {
            val vm = viewModel { json("[]") }
            vm.load()
            val state = vm.state.first { it is TripsListUiState.Loaded } as TripsListUiState.Loaded
            assertTrue(state.trips.isEmpty())
        }

    @Test
    fun `load failure shows retry state and retry recovers`() =
        runTest(dispatcher) {
            var fail = true
            val vm =
                viewModel {
                    if (fail) json("""{"error":{}}""", HttpStatusCode.InternalServerError) else json(TRIPS_JSON)
                }
            vm.load()
            vm.state.first { it is TripsListUiState.LoadFailed }

            fail = false
            vm.load()
            vm.state.first { it is TripsListUiState.Loaded }
        }
}
