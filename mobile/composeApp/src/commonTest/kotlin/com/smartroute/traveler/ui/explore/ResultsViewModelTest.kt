package com.smartroute.traveler.ui.explore

import com.smartroute.traveler.data.CityCatalog
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
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.Json
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
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

private const val EUR_RESPONSE_JSON = """
{"options": [
  {"label": "recommended", "order": ["SOF", "BEG"], "flights": [],
    "totalPriceCents": 9300, "totalDurationMin": 60}
], "currency": "EUR"}
"""

private const val CITIES_JSON = """
[{"iata": "SOF", "name": "Sofia", "country": "Bulgaria", "lat": 42.7, "lon": 23.3},
 {"iata": "BEG", "name": "Belgrade", "country": "Serbia", "lat": 44.8, "lon": 20.4}]
"""

private const val NO_ROUTE_JSON = """{"options": [], "reason": "No viable routes found."}"""

private const val TRIP_CREATED_JSON = """
{"id": "trip_1", "name": "SOF → BEG", "startDate": "2026-08-01T00:00:00.000Z",
  "endDate": "2026-08-04T00:00:00.000Z", "cabinClass": "ECONOMY", "travelers": 1,
  "flights": [], "totalPriceCents": 84700,
  "createdAt": "2026-07-12T00:00:00Z", "updatedAt": "2026-07-12T00:00:00Z"}
"""

private val LENIENT_JSON = Json { ignoreUnknownKeys = true }

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

    private fun viewModel(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData): ResultsViewModel {
        val api =
            ApiClient(
                MockEngine { request ->
                    if (request.url.encodedPath == "/cities") json(CITIES_JSON) else handler(request)
                },
                "https://api.example.dev",
            ) { "jwt" }
        return ResultsViewModel(api, REQUEST, CityCatalog(api))
    }

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
                LENIENT_JSON
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

    @Test
    fun `prices carry the response currency, USD from an older backend`() =
        runTest(dispatcher) {
            val eur = viewModel { json(EUR_RESPONSE_JSON) }
            eur.load()
            assertEquals("EUR", (eur.state.first { it is ResultsUiState.Loaded } as ResultsUiState.Loaded).currency)

            val legacy = viewModel { json(OPTIMIZE_RESPONSE_JSON) }
            legacy.load()
            assertEquals("USD", (legacy.state.first { it is ResultsUiState.Loaded } as ResultsUiState.Loaded).currency)
        }

    @Test
    fun `saving stores the currency the route was priced in`() =
        runTest(dispatcher) {
            var createdBody: String? = null
            val vm =
                viewModel { request ->
                    when (request.url.encodedPath) {
                        "/optimize" -> json(EUR_RESPONSE_JSON)
                        else -> {
                            createdBody = request.body.toByteArray().decodeToString()
                            json(TRIP_CREATED_JSON, HttpStatusCode.Created)
                        }
                    }
                }
            vm.load()
            vm.state.first { it is ResultsUiState.Loaded }
            vm.selectOption(0)
            vm.save()
            vm.state.first { (it as? ResultsUiState.Loaded)?.savedTripId != null }

            val decoded = LENIENT_JSON.decodeFromString<CreateTripRequestDto>(createdBody!!)
            assertEquals("EUR", decoded.currency)
        }

    @Test
    fun `selecting a preset re-runs optimize with it and clears the selection`() =
        runTest(dispatcher) {
            val optimizeBodies = mutableListOf<String>()
            val vm =
                viewModel { request ->
                    optimizeBodies += request.body.toByteArray().decodeToString()
                    json(OPTIMIZE_RESPONSE_JSON)
                }
            vm.load()
            vm.state.first { it is ResultsUiState.Loaded }
            vm.selectOption(0)

            vm.selectPreset(OptimizePreset.BUDGET)
            advanceUntilIdle()

            val state = vm.state.first { it is ResultsUiState.Loaded && !it.reloading } as ResultsUiState.Loaded
            assertEquals(2, optimizeBodies.size)
            val decoded = LENIENT_JSON.decodeFromString<OptimizeRequestDto>(optimizeBodies[1])
            assertEquals(OptimizePreset.BUDGET, decoded.preset)
            assertNull(state.selectedIndex)
            assertEquals(OptimizePreset.BUDGET, state.preset)
            assertFalse(state.reloading)
        }

    @Test
    fun `selecting the current preset does nothing`() =
        runTest(dispatcher) {
            var optimizeCalls = 0
            val vm =
                viewModel {
                    optimizeCalls++
                    json(OPTIMIZE_RESPONSE_JSON)
                }
            vm.load()
            vm.state.first { it is ResultsUiState.Loaded }

            vm.selectPreset(OptimizePreset.BALANCED)
            advanceUntilIdle()

            assertEquals(1, optimizeCalls)
        }

    @Test
    fun `a preset change during a save is ignored`() =
        runTest(dispatcher) {
            var optimizeCalls = 0
            val gate = CompletableDeferred<Unit>()
            val vm =
                viewModel { request ->
                    when (request.url.encodedPath) {
                        "/optimize" -> {
                            optimizeCalls++
                            json(OPTIMIZE_RESPONSE_JSON)
                        }
                        else -> {
                            gate.await()
                            json(TRIP_CREATED_JSON, HttpStatusCode.Created)
                        }
                    }
                }
            vm.load()
            vm.state.first { it is ResultsUiState.Loaded }
            vm.selectOption(0)
            vm.save()
            vm.state.first { (it as? ResultsUiState.Loaded)?.saving == true }

            vm.selectPreset(OptimizePreset.TIME)
            advanceUntilIdle()
            assertEquals(1, optimizeCalls)

            gate.complete(Unit)
            val state = vm.state.first { (it as? ResultsUiState.Loaded)?.savedTripId != null } as ResultsUiState.Loaded
            assertEquals("trip_1", state.savedTripId)
            assertEquals(OptimizePreset.BALANCED, state.preset)
        }

    @Test
    fun `coordinates come from the catalog`() =
        runTest(dispatcher) {
            val vm = viewModel { json(OPTIMIZE_RESPONSE_JSON) }
            vm.load()
            val state = vm.state.first { it is ResultsUiState.Loaded } as ResultsUiState.Loaded
            assertEquals(setOf("SOF", "BEG"), state.coordinates.keys)
        }

    @Test
    fun `a catalog failure still loads routes with an empty map`() =
        runTest(dispatcher) {
            val api =
                ApiClient(
                    MockEngine { request ->
                        if (request.url.encodedPath == "/cities") {
                            json("""{"error":{}}""", HttpStatusCode.InternalServerError)
                        } else {
                            json(OPTIMIZE_RESPONSE_JSON)
                        }
                    },
                    "https://api.example.dev",
                ) { "jwt" }
            val vm = ResultsViewModel(api, REQUEST, CityCatalog(api))
            vm.load()
            val state = vm.state.first { it is ResultsUiState.Loaded } as ResultsUiState.Loaded
            assertEquals(2, state.options.size)
            assertTrue(state.coordinates.isEmpty())
        }

    @Test
    fun `a second preset during a re-run supersedes it without ever showing the error state`() =
        runTest(dispatcher) {
            val gate = CompletableDeferred<Unit>()
            var optimizeCalls = 0
            val vm =
                viewModel {
                    optimizeCalls++
                    if (optimizeCalls == 2) gate.await()
                    json(OPTIMIZE_RESPONSE_JSON)
                }
            vm.load()
            vm.state.first { it is ResultsUiState.Loaded }

            val seen = mutableListOf<ResultsUiState>()
            val collector = backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.state.toList(seen) }

            vm.selectPreset(OptimizePreset.BUDGET)
            advanceUntilIdle()
            vm.selectPreset(OptimizePreset.TIME)
            advanceUntilIdle()
            gate.complete(Unit)
            advanceUntilIdle()

            val state = vm.state.first { it is ResultsUiState.Loaded && !it.reloading } as ResultsUiState.Loaded
            assertEquals(OptimizePreset.TIME, state.preset)
            assertFalse(state.reloading)
            assertTrue(seen.none { it is ResultsUiState.LoadFailed }, "error state flashed: $seen")
            collector.cancel()
        }
}
