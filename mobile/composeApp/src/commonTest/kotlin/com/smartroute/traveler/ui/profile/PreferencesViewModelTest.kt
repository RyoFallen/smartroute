package com.smartroute.traveler.ui.profile

import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.UpdatePreferencesRequestDto
import com.smartroute.traveler.domain.TripIntensity
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
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

private const val PROFILE_JSON =
    """{"profile": {"intensity": "PACKED", "wakeUpTime": "07:30", "interests": []}}"""
private const val NULL_PROFILE_JSON = """{"profile": null}"""

@OptIn(ExperimentalCoroutinesApi::class)
class PreferencesViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val json = Json { ignoreUnknownKeys = true }

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

    private fun viewModel(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData): PreferencesViewModel =
        PreferencesViewModel(
            ApiClient(MockEngine { handler(it) }, "https://api.example.dev") { "jwt" },
        )

    @Test
    fun `load prefills stored preferences`() =
        runTest(dispatcher) {
            val vm = viewModel { json(PROFILE_JSON) }
            vm.load()
            val state = vm.state.first { it is PreferencesUiState.Editing }
            assertEquals(
                PreferencesUiState.Editing(intensity = TripIntensity.PACKED, wakeUpTime = "07:30"),
                state,
            )
        }

    @Test
    fun `null profile shows the documented defaults`() =
        runTest(dispatcher) {
            val vm = viewModel { json(NULL_PROFILE_JSON) }
            vm.load()
            val state = vm.state.first { it is PreferencesUiState.Editing }
            assertEquals(
                PreferencesUiState.Editing(intensity = TripIntensity.MODERATE, wakeUpTime = "09:00"),
                state,
            )
        }

    @Test
    fun `load failure shows retry state and retry recovers`() =
        runTest(dispatcher) {
            var fail = true
            val vm =
                viewModel {
                    if (fail) json("""{"error":{}}""", HttpStatusCode.InternalServerError) else json(PROFILE_JSON)
                }
            vm.load()
            vm.state.first { it is PreferencesUiState.LoadFailed }

            fail = false
            vm.load()
            vm.state.first { it is PreferencesUiState.Editing }
        }

    @Test
    fun `save sends edited values through the upsert endpoint`() =
        runTest(dispatcher) {
            var submitted: UpdatePreferencesRequestDto? = null
            val vm =
                viewModel { request ->
                    when (request.method) {
                        HttpMethod.Get -> json(NULL_PROFILE_JSON)
                        else -> {
                            submitted =
                                json.decodeFromString<UpdatePreferencesRequestDto>(
                                    request.body.toByteArray().decodeToString(),
                                )
                            json(PROFILE_JSON)
                        }
                    }
                }
            vm.load()
            vm.state.first { it is PreferencesUiState.Editing }

            vm.setIntensity(TripIntensity.RELAXED)
            vm.setWakeUpTime("10:15")
            vm.save()

            vm.state.first { it is PreferencesUiState.Editing && (it as PreferencesUiState.Editing).saved }
            assertEquals(UpdatePreferencesRequestDto("RELAXED", "10:15"), submitted)
        }

    @Test
    fun `save failure keeps edits with an error and retry succeeds`() =
        runTest(dispatcher) {
            var failPut = true
            val vm =
                viewModel { request ->
                    when {
                        request.method == HttpMethod.Get -> json(NULL_PROFILE_JSON)
                        failPut -> json("""{"error":{}}""", HttpStatusCode.InternalServerError)
                        else -> json(PROFILE_JSON)
                    }
                }
            vm.load()
            vm.state.first { it is PreferencesUiState.Editing }

            vm.setWakeUpTime("06:45")
            vm.save()
            val failed =
                vm.state.first {
                    it is PreferencesUiState.Editing && (it as PreferencesUiState.Editing).saveFailed
                } as PreferencesUiState.Editing
            assertEquals("06:45", failed.wakeUpTime)

            failPut = false
            vm.save()
            vm.state.first { it is PreferencesUiState.Editing && (it as PreferencesUiState.Editing).saved }
        }
}
