package com.smartroute.traveler.ui.explore

import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.CitySummaryDto
import com.smartroute.traveler.domain.OptimizePreset
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
import kotlin.test.assertNull

private const val CITIES_JSON = """
[{"iata": "SOF", "name": "Sofia", "country": "Bulgaria"},
 {"iata": "BEG", "name": "Belgrade", "country": "Serbia"},
 {"iata": "TIA", "name": "Tirana", "country": "Albania"}]
"""

@OptIn(ExperimentalCoroutinesApi::class)
class TripConfigViewModelTest {
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

    private fun viewModel(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData): TripConfigViewModel =
        TripConfigViewModel(
            ApiClient(MockEngine { handler(it) }, "https://api.example.dev") { "jwt" },
        )

    @Test
    fun `load fetches the curated city list`() =
        runTest(dispatcher) {
            val vm = viewModel { json(CITIES_JSON) }
            vm.load()
            val state = vm.state.first { it is TripConfigUiState.Ready } as TripConfigUiState.Ready
            assertEquals(3, state.cities.size)
            assertEquals(emptyList(), state.selected)
        }

    @Test
    fun `load failure shows retry state and retry recovers`() =
        runTest(dispatcher) {
            var fail = true
            val vm =
                viewModel {
                    if (fail) json("""{"error":{}}""", HttpStatusCode.InternalServerError) else json(CITIES_JSON)
                }
            vm.load()
            vm.state.first { it is TripConfigUiState.LoadFailed }

            fail = false
            vm.load()
            vm.state.first { it is TripConfigUiState.Ready }
        }

    @Test
    fun `toggling a city adds it with a default stay, toggling again removes it`() =
        runTest(dispatcher) {
            val vm = viewModel { json(CITIES_JSON) }
            vm.load()
            vm.state.first { it is TripConfigUiState.Ready }
            val sofia = CitySummaryDto("SOF", "Sofia", "Bulgaria")

            vm.toggleCity(sofia)
            val afterAdd = vm.state.first { (it as? TripConfigUiState.Ready)?.selected?.isNotEmpty() == true }
            assertEquals(listOf(SelectedCity("SOF", "Sofia", 2)), (afterAdd as TripConfigUiState.Ready).selected)

            vm.toggleCity(sofia)
            val afterRemove = vm.state.value as TripConfigUiState.Ready
            assertEquals(emptyList(), afterRemove.selected)
        }

    @Test
    fun `toggling an already-selected city cannot select a ninth`() =
        runTest(dispatcher) {
            val eightCities = (1..8).map { CitySummaryDto("C$it", "City $it", "Land") }
            val vm = viewModel { json(CITIES_JSON) }
            vm.load()
            vm.state.first { it is TripConfigUiState.Ready }
            eightCities.forEach { vm.toggleCity(it) }
            val ninth = CitySummaryDto("C9", "City 9", "Land")

            vm.toggleCity(ninth)

            val state = vm.state.value as TripConfigUiState.Ready
            assertEquals(8, state.selected.size)
        }

    @Test
    fun `setDays updates only the targeted city`() =
        runTest(dispatcher) {
            val vm = viewModel { json(CITIES_JSON) }
            vm.load()
            vm.state.first { it is TripConfigUiState.Ready }
            vm.toggleCity(CitySummaryDto("SOF", "Sofia", "Bulgaria"))
            vm.toggleCity(CitySummaryDto("BEG", "Belgrade", "Serbia"))
            vm.state.first { (it as? TripConfigUiState.Ready)?.selected?.size == 2 }

            vm.setDays("SOF", 5)

            val state = vm.state.value as TripConfigUiState.Ready
            assertEquals(5, state.selected.first { it.iata == "SOF" }.days)
            assertEquals(2, state.selected.first { it.iata == "BEG" }.days)
        }

    @Test
    fun `buildRequest is null with fewer than 2 cities or a blank date`() =
        runTest(dispatcher) {
            val vm = viewModel { json(CITIES_JSON) }
            vm.load()
            vm.state.first { it is TripConfigUiState.Ready }
            vm.toggleCity(CitySummaryDto("SOF", "Sofia", "Bulgaria"))

            assertNull(vm.buildRequest())

            vm.toggleCity(CitySummaryDto("BEG", "Belgrade", "Serbia"))
            vm.state.first { (it as? TripConfigUiState.Ready)?.selected?.size == 2 }
            assertNull(vm.buildRequest()) // departDate still blank
        }

    @Test
    fun `buildRequest reflects selection, per-city stay, preset and directOnly`() =
        runTest(dispatcher) {
            val vm = viewModel { json(CITIES_JSON) }
            vm.load()
            vm.state.first { it is TripConfigUiState.Ready }
            vm.toggleCity(CitySummaryDto("SOF", "Sofia", "Bulgaria"))
            vm.toggleCity(CitySummaryDto("BEG", "Belgrade", "Serbia"))
            vm.state.first { (it as? TripConfigUiState.Ready)?.selected?.size == 2 }
            vm.setDays("SOF", 4)
            vm.setPreset(OptimizePreset.BUDGET)
            vm.setDirectOnly(true)
            vm.setDepartDate("2026-08-01")

            val request = vm.buildRequest()

            assertEquals(listOf("SOF", "BEG"), request?.cities)
            assertEquals(listOf(4, 2), request?.perCityDays)
            assertEquals("2026-08-01", request?.departDate)
            assertEquals(OptimizePreset.BUDGET, request?.preset)
            assertEquals(true, request?.directOnly)
            assertEquals(1, request?.travelers)
            assertEquals("ECONOMY", request?.cabinClass)
        }
}
