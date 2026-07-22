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
import kotlin.test.assertFalse

private const val TRIP_PLAN_JSON = """
{"tripId": "trip_1", "cities": [
  {"iata": "SOF", "name": "Sofia", "available": true, "mustGo": [
    {"id": "a1", "name": "Alexander Nevsky Cathedral", "category": "RELIGIOUS",
      "rank": 1, "lat": 42.6957, "lon": 23.3327, "description": "A neo-Byzantine cathedral."}
  ]},
  {"iata": "BEG", "name": null, "available": false, "mustGo": []}
]}
"""

@OptIn(ExperimentalCoroutinesApi::class)
class TripPlanViewModelTest {
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

    private fun viewModel(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData): TripPlanViewModel =
        TripPlanViewModel(
            ApiClient(MockEngine { handler(it) }, "https://api.example.dev") { "jwt" },
            "trip_1",
        )

    @Test
    fun `load renders per-city must-go attractions`() =
        runTest(dispatcher) {
            val vm = viewModel { json(TRIP_PLAN_JSON) }
            vm.load()
            val state = vm.state.first { it is TripPlanUiState.Loaded } as TripPlanUiState.Loaded
            assertEquals(2, state.cities.size)
            assertEquals("Sofia", state.cities[0].name)
            assertFalse(state.cities[1].available)
        }

    @Test
    fun `load failure shows retry state and retry recovers`() =
        runTest(dispatcher) {
            var fail = true
            val vm =
                viewModel {
                    if (fail) json("""{"error":{}}""", HttpStatusCode.InternalServerError) else json(TRIP_PLAN_JSON)
                }
            vm.load()
            vm.state.first { it is TripPlanUiState.LoadFailed }

            fail = false
            vm.load()
            vm.state.first { it is TripPlanUiState.Loaded }
        }
}
