package com.smartroute.traveler.ui.profile

import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.ReplaceInterestsRequestDto
import com.smartroute.traveler.domain.InterestCategory
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
import kotlin.test.assertTrue

private const val PROFILE_WITH_INTERESTS_JSON =
    """{"profile": {"intensity": "MODERATE", "wakeUpTime": "09:00", "interests": [
        {"category": "museums-galleries", "rating": 1},
        {"category": "nightlife-bars", "rating": -1}
    ]}}"""
private const val NULL_PROFILE_JSON = """{"profile": null}"""

@OptIn(ExperimentalCoroutinesApi::class)
class InterestsViewModelTest {
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

    private fun viewModel(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData): InterestsViewModel =
        InterestsViewModel(
            ApiClient(MockEngine { handler(it) }, "https://api.example.dev") { "jwt" },
        )

    @Test
    fun `load lists all 15 categories with stored ratings and neutral for the rest`() =
        runTest(dispatcher) {
            val vm = viewModel { json(PROFILE_WITH_INTERESTS_JSON) }
            vm.load()
            val state = vm.state.first { it is InterestsUiState.Editing } as InterestsUiState.Editing
            assertEquals(InterestCategory.entries.toSet(), state.ratings.keys)
            assertEquals(1, state.ratings[InterestCategory.MUSEUMS_GALLERIES])
            assertEquals(-1, state.ratings[InterestCategory.NIGHTLIFE_BARS])
            assertEquals(0, state.ratings[InterestCategory.SHOPPING])
        }

    @Test
    fun `a user who skipped onboarding sees all-neutral ratings`() =
        runTest(dispatcher) {
            val vm = viewModel { json(NULL_PROFILE_JSON) }
            vm.load()
            val state = vm.state.first { it is InterestsUiState.Editing } as InterestsUiState.Editing
            assertTrue(state.ratings.values.all { it == 0 })
        }

    @Test
    fun `load failure shows retry state and retry recovers`() =
        runTest(dispatcher) {
            var fail = true
            val vm =
                viewModel {
                    if (fail) {
                        json("""{"error":{}}""", HttpStatusCode.InternalServerError)
                    } else {
                        json(PROFILE_WITH_INTERESTS_JSON)
                    }
                }
            vm.load()
            vm.state.first { it is InterestsUiState.LoadFailed }

            fail = false
            vm.load()
            vm.state.first { it is InterestsUiState.Editing }
        }

    @Test
    fun `editing one rating and saving sends the complete set through full replace`() =
        runTest(dispatcher) {
            var submitted: ReplaceInterestsRequestDto? = null
            val vm =
                viewModel { request ->
                    when (request.method) {
                        HttpMethod.Get -> json(PROFILE_WITH_INTERESTS_JSON)
                        else -> {
                            submitted =
                                json.decodeFromString<ReplaceInterestsRequestDto>(
                                    request.body.toByteArray().decodeToString(),
                                )
                            json(PROFILE_WITH_INTERESTS_JSON)
                        }
                    }
                }
            vm.load()
            vm.state.first { it is InterestsUiState.Editing }

            vm.setRating(InterestCategory.FOOD_DINING, 1)
            vm.save()

            vm.state.first { it is InterestsUiState.Editing && (it as InterestsUiState.Editing).saved }
            val body = submitted ?: error("nothing submitted")
            assertEquals(15, body.interests.size)
            val byCategory = body.interests.associate { it.category to it.rating }
            assertEquals(1, byCategory["food-dining"])
            assertEquals(1, byCategory["museums-galleries"])
            assertEquals(-1, byCategory["nightlife-bars"])
            assertEquals(0, byCategory["shopping"])
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
                        else -> json(NULL_PROFILE_JSON)
                    }
                }
            vm.load()
            vm.state.first { it is InterestsUiState.Editing }

            vm.setRating(InterestCategory.SHOPPING, -1)
            vm.save()
            val failed =
                vm.state.first {
                    it is InterestsUiState.Editing && (it as InterestsUiState.Editing).saveFailed
                } as InterestsUiState.Editing
            assertEquals(-1, failed.ratings[InterestCategory.SHOPPING])

            failPut = false
            vm.save()
            vm.state.first { it is InterestsUiState.Editing && (it as InterestsUiState.Editing).saved }
        }
}
