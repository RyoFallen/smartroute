package com.smartroute.traveler.ui.explore

import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.CreateTripRequestDto
import com.smartroute.traveler.data.api.OptimizeRequestDto
import com.smartroute.traveler.domain.OptimizePreset
import com.smartroute.traveler.domain.RouteLabel
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
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
import kotlinx.serialization.json.Json
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

private const val OPTIMIZE_RESPONSE_JSON = """
{"options": [
  {"label": "recommended", "order": ["SOF", "BEG"], "flights": [],
    "totalPriceCents": 84700, "totalDurationMin": 180},
  {"label": "cheapest", "order": ["SOF", "BEG"], "flights": [],
    "totalPriceCents": 70000, "totalDurationMin": 210}
]}
"""

private const val NO_ROUTE_JSON = """{"options": [], "reason": "No viable routes found."}"""

private const val TRIP_CREATED_JSON = """
{"id": "trip_1", "name": "SOF → BEG", "startDate": "2026-08-01T00:00:00.000Z",
  "endDate": "2026-08-04T00:00:00.000Z", "cabinClass": "ECONOMY", "travelers": 1,
  "flights": [], "totalPriceCents": 84700,
  "createdAt": "2026-07-12T00:00:00Z", "updatedAt": "2026-07-12T00:00:00Z"}
"""

private val REQUEST =
    OptimizeRequestDto(
        cities = listOf("SOF", "BEG"),
        departDate = "2026-08-01",
        perCityDays = listOf(0, 3),
        startCity = "SOF",
        travelers = 1,
        cabinClass = "ECONOMY",
        directOnly = false,
        preset = OptimizePreset.BALANCED,
    )

@OptIn(ExperimentalCoroutinesApi::class)
class ResultsViewModelTest {
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

    private fun viewModel(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData): ResultsViewModel =
        ResultsViewModel(
            ApiClient(MockEngine { handler(it) }, "https://api.example.dev") { "jwt" },
            REQUEST,
        )

    @Test
    fun `load runs the optimize request and renders the returned options`() =
        runTest(dispatcher) {
            val vm = viewModel { json(OPTIMIZE_RESPONSE_JSON) }
            vm.load()
            val state = vm.state.first { it is ResultsUiState.Loaded } as ResultsUiState.Loaded
            assertEquals(2, state.options.size)
            assertEquals(RouteLabel.RECOMMENDED, state.options.first().label)
        }

    @Test
    fun `an empty options list with a reason renders as no-viable-route, not a failure`() =
        runTest(dispatcher) {
            val vm = viewModel { json(NO_ROUTE_JSON) }
            vm.load()
            val state = vm.state.first { it is ResultsUiState.Loaded } as ResultsUiState.Loaded
            assertTrue(state.options.isEmpty())
            assertEquals("No viable routes found.", state.reason)
        }

    @Test
    fun `load failure shows retry state and retry recovers`() =
        runTest(dispatcher) {
            var fail = true
            val vm =
                viewModel {
                    if (fail) json("""{"error":{}}""", HttpStatusCode.InternalServerError) else json(OPTIMIZE_RESPONSE_JSON)
                }
            vm.load()
            vm.state.first { it is ResultsUiState.LoadFailed }

            fail = false
            vm.load()
            val state = vm.state.first { it is ResultsUiState.Loaded } as ResultsUiState.Loaded
            assertEquals(2, state.options.size)
        }

    @Test
    fun `saving ends the trip after the stays of the cities visited, not the origin`() =
        runTest(dispatcher) {
            var createdBody: String? = null
            val vm =
                viewModel { request ->
                    when (request.url.encodedPath) {
                        "/optimize" -> json(OPTIMIZE_RESPONSE_JSON)
                        "/trips" -> {
                            createdBody = request.body.toByteArray().decodeToString()
                            json(TRIP_CREATED_JSON, HttpStatusCode.Created)
                        }
                        else -> error("unexpected path ${request.url.encodedPath}")
                    }
                }
            vm.load()
            vm.state.first { it is ResultsUiState.Loaded }

            vm.selectOption(0)
            vm.save()

            val state =
                vm.state.first { (it as? ResultsUiState.Loaded)?.savedTripId != null } as ResultsUiState.Loaded
            assertEquals("trip_1", state.savedTripId)

            val decoded =
                Json { ignoreUnknownKeys = true }
                    .decodeFromString<CreateTripRequestDto>(createdBody!!)
            // #34: Sofia is where the traveler flies out from, so the trip ends
            // after Belgrade's stay alone — 2026-08-01 + 3 days, not + 2 + 3.
            assertEquals("2026-08-04", decoded.endDate)
            assertEquals("2026-08-01", decoded.startDate)
            assertEquals(listOf("SOF", "BEG"), decoded.cities)
        }

    @Test
    fun `save failure shows an error without losing the selection`() =
        runTest(dispatcher) {
            val vm =
                viewModel { request ->
                    when (request.url.encodedPath) {
                        "/optimize" -> json(OPTIMIZE_RESPONSE_JSON)
                        "/trips" -> json("""{"error":{}}""", HttpStatusCode.InternalServerError)
                        else -> error("unexpected path ${request.url.encodedPath}")
                    }
                }
            vm.load()
            vm.state.first { it is ResultsUiState.Loaded }

            vm.selectOption(1)
            vm.save()

            val state = vm.state.first { (it as? ResultsUiState.Loaded)?.saveFailed == true } as ResultsUiState.Loaded
            assertEquals(1, state.selectedIndex)
            assertNull(state.savedTripId)
        }
}
