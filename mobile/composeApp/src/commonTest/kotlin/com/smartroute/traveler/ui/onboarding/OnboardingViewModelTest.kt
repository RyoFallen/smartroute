package com.smartroute.traveler.ui.onboarding

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
import kotlin.test.assertIs
import kotlin.test.assertTrue

private const val PROFILE_JSON =
    """{"profile": {"intensity": "MODERATE", "wakeUpTime": "09:00", "interests": []}}"""
private const val NULL_PROFILE_JSON = """{"profile": null}"""

@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingViewModelTest {
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

    private fun viewModel(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData): OnboardingViewModel =
        OnboardingViewModel(
            ApiClient(MockEngine { handler(it) }, "https://api.example.dev") { "jwt" },
        )

    @Test
    fun `null profile routes to the deck`() =
        runTest(dispatcher) {
            val vm = viewModel { json(NULL_PROFILE_JSON) }
            vm.refresh()
            val state = vm.state.first { it !is OnboardingUiState.Loading }
            assertEquals(OnboardingUiState.Deck(cardIndex = 0), state)
        }

    @Test
    fun `existing profile skips the deck entirely`() =
        runTest(dispatcher) {
            val vm = viewModel { json(PROFILE_JSON) }
            vm.refresh()
            val state = vm.state.first { it !is OnboardingUiState.Loading }
            assertEquals(OnboardingUiState.Complete, state)
        }

    @Test
    fun `fetch failure shows retry state and retry recovers`() =
        runTest(dispatcher) {
            var fail = true
            val vm =
                viewModel {
                    if (fail) json("""{"error":{}}""", HttpStatusCode.InternalServerError) else json(NULL_PROFILE_JSON)
                }
            vm.refresh()
            vm.state.first { it is OnboardingUiState.LoadFailed }

            fail = false
            vm.refresh()
            val state = vm.state.first { it !is OnboardingUiState.Loading && it !is OnboardingUiState.LoadFailed }
            assertEquals(OnboardingUiState.Deck(cardIndex = 0), state)
        }

    @Test
    fun `completing the deck submits all 15 ratings in one full-replace call`() =
        runTest(dispatcher) {
            var submitted: ReplaceInterestsRequestDto? = null
            val vm =
                viewModel { request ->
                    when {
                        request.method == HttpMethod.Get -> json(NULL_PROFILE_JSON)
                        else -> {
                            submitted =
                                json.decodeFromString<ReplaceInterestsRequestDto>(
                                    request.body.toByteArray().decodeToString(),
                                )
                            json(PROFILE_JSON)
                        }
                    }
                }
            vm.refresh()
            vm.state.first { it is OnboardingUiState.Deck }

            // like the first card, dislike the second, tap-skip the rest
            vm.rateCurrent(1)
            vm.rateCurrent(-1)
            repeat(13) { vm.rateCurrent(0) }

            vm.state.first { it is OnboardingUiState.Complete }
            val body = submitted ?: error("nothing submitted")
            assertEquals(15, body.interests.size)
            assertEquals(
                InterestCategory.entries.map { it.slug },
                body.interests.map { it.category },
            )
            assertEquals(1, body.interests[0].rating)
            assertEquals(-1, body.interests[1].rating)
            assertTrue(body.interests.drop(2).all { it.rating == 0 })
        }

    @Test
    fun `skip for now submits all-neutral ratings`() =
        runTest(dispatcher) {
            var submitted: ReplaceInterestsRequestDto? = null
            val vm =
                viewModel { request ->
                    when {
                        request.method == HttpMethod.Get -> json(NULL_PROFILE_JSON)
                        else -> {
                            submitted =
                                json.decodeFromString<ReplaceInterestsRequestDto>(
                                    request.body.toByteArray().decodeToString(),
                                )
                            json(PROFILE_JSON)
                        }
                    }
                }
            vm.refresh()
            vm.state.first { it is OnboardingUiState.Deck }

            vm.rateCurrent(1) // a partial swipe, then the user bails
            vm.skipAll()

            vm.state.first { it is OnboardingUiState.Complete }
            val body = submitted ?: error("nothing submitted")
            assertEquals(15, body.interests.size)
            assertTrue(body.interests.all { it.rating == 0 })
        }

    @Test
    fun `submit failure keeps the deck with an error and retry completes`() =
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
            vm.refresh()
            vm.state.first { it is OnboardingUiState.Deck }

            vm.skipAll()
            val failed = vm.state.first { it is OnboardingUiState.Deck && (it as OnboardingUiState.Deck).submitFailed }
            assertIs<OnboardingUiState.Deck>(failed)

            failPut = false
            vm.retrySubmit()
            vm.state.first { it is OnboardingUiState.Complete }
        }
}
