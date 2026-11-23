package com.smartroute.traveler.ui.home

import com.smartroute.traveler.data.CityCatalog
import com.smartroute.traveler.data.api.ApiClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.datetime.LocalDate
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private const val TRIPS_JSON = """
[{"id": "trip_1", "name": "Balkans", "startDate": "2026-12-05T00:00:00.000Z", "endDate": "2026-12-10T00:00:00.000Z",
  "cabinClass": "ECONOMY", "travelers": 1, "cities": ["SOF", "BEG", "TIA"],
  "flights": [], "totalPriceCents": 84700, "currency": "EUR",
  "createdAt": "2026-07-12T00:00:00Z", "updatedAt": "2026-07-12T00:00:00Z"}]
"""

private const val CITIES_JSON = """
[{"iata": "SOF", "name": "Sofia", "country": "Bulgaria", "lat": 42.7, "lon": 23.3},
 {"iata": "BEG", "name": "Belgrade", "country": "Serbia", "lat": 44.8, "lon": 20.4}]
"""

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {
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
        tripsStatus: () -> HttpStatusCode = { HttpStatusCode.OK },
        citiesStatus: HttpStatusCode = HttpStatusCode.OK,
    ): HomeViewModel {
        val api =
            ApiClient(
                MockEngine { request ->
                    if (request.url.encodedPath.endsWith("/cities")) {
                        json(CITIES_JSON, citiesStatus)
                    } else {
                        val status = tripsStatus()
                        json(if (status == HttpStatusCode.OK) TRIPS_JSON else """{"error":{}}""", status)
                    }
                },
                "https://api.example.dev",
            ) { "jwt" }
        return HomeViewModel(api, CityCatalog(api)) { LocalDate(2026, 12, 1) }
    }

    @Test
    fun `loads trips and coordinates`() =
        runTest(dispatcher) {
            val vm = viewModel()
            vm.load()
            val state = vm.state.first { it is HomeUiState.Loaded } as HomeUiState.Loaded
            assertEquals(
                "trip_1",
                state.content.upcoming
                    ?.trip
                    ?.id,
            )
            assertEquals(4, state.content.upcoming?.daysUntil)
            assertEquals(setOf("SOF", "BEG"), state.coordinates.keys)
        }

    @Test
    fun `Home renders with an empty catalog`() =
        runTest(dispatcher) {
            val vm = viewModel(citiesStatus = HttpStatusCode.InternalServerError)
            vm.load()
            val state = vm.state.first { it is HomeUiState.Loaded } as HomeUiState.Loaded
            assertTrue(state.coordinates.isEmpty())
            assertEquals(
                "trip_1",
                state.content.upcoming
                    ?.trip
                    ?.id,
            )
        }

    @Test
    fun `trips failure is LoadFailed and retry recovers`() =
        runTest(dispatcher) {
            var fail = true
            val vm = viewModel(tripsStatus = { if (fail) HttpStatusCode.InternalServerError else HttpStatusCode.OK })
            vm.load()
            vm.state.first { it is HomeUiState.LoadFailed }

            fail = false
            vm.load()
            vm.state.first { it is HomeUiState.Loaded }
        }

    @Test
    fun `a second load keeps the content on screen while it refreshes`() =
        runTest(dispatcher) {
            val gate = CompletableDeferred<Unit>()
            var tripsCalls = 0
            val api =
                ApiClient(
                    MockEngine { request ->
                        if (request.url.encodedPath.endsWith("/cities")) {
                            json(CITIES_JSON)
                        } else {
                            tripsCalls++
                            if (tripsCalls == 2) {
                                gate.await()
                                json("[]")
                            } else {
                                json(TRIPS_JSON)
                            }
                        }
                    },
                    "https://api.example.dev",
                ) { "jwt" }
            val vm = HomeViewModel(api, CityCatalog(api)) { LocalDate(2026, 12, 1) }
            vm.load()
            val first = vm.state.first { it is HomeUiState.Loaded } as HomeUiState.Loaded
            assertEquals(
                "trip_1",
                first.content.upcoming
                    ?.trip
                    ?.id,
            )

            val seen = mutableListOf<HomeUiState>()
            val collector = launch(UnconfinedTestDispatcher(testScheduler)) { vm.state.collect { seen += it } }
            vm.load()
            advanceUntilIdle() // second request is now parked on the gate
            assertTrue(seen.all { it is HomeUiState.Loaded }, "never Loading during a refresh: $seen")
            assertEquals(
                "trip_1",
                (vm.state.value as HomeUiState.Loaded)
                    .content.upcoming
                    ?.trip
                    ?.id,
            )

            gate.complete(Unit)
            val refreshed = vm.state.first { it is HomeUiState.Loaded && it.content.upcoming == null }
            collector.cancel()
            assertTrue(refreshed is HomeUiState.Loaded)
            assertTrue(seen.all { it is HomeUiState.Loaded }, "never Loading after the response either: $seen")
        }
}
