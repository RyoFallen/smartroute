package com.smartroute.traveler.ui.auth

import com.russhwolf.settings.MapSettings
import com.smartroute.traveler.data.auth.ClerkAuthClient
import com.smartroute.traveler.data.storage.TokenStore
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
import kotlin.test.assertIs

private const val FAPI = "https://clerk.example.dev"

@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {
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
        store: TokenStore = TokenStore(MapSettings()),
        handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData,
    ): AuthViewModel = AuthViewModel(ClerkAuthClient(MockEngine { handler(it) }, FAPI, store))

    private fun happyPathHandler(): suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData =
        { request ->
            when {
                request.url.encodedPath == "/v1/client/sign_ins" ->
                    json(
                        """
                        {"response": {"id": "sia_1", "status": "needs_first_factor",
                          "supported_first_factors": [
                            {"strategy": "email_code", "email_address_id": "idn_9"}]}}
                        """.trimIndent(),
                    )
                request.url.encodedPath.endsWith("/prepare_first_factor") ->
                    json("""{"response": {"id": "sia_1", "status": "needs_first_factor"}}""")
                request.url.encodedPath.endsWith("/attempt_first_factor") ->
                    json("""{"response": {"id": "sia_1", "status": "complete", "created_session_id": "sess_7"}}""")
                request.url.encodedPath.endsWith("/remove") ->
                    json("""{}""")
                else -> error("Unexpected call: ${request.url}")
            }
        }

    @Test
    fun `starts signed out on empty store`() =
        runTest(dispatcher) {
            val vm = viewModel { error("no network") }
            assertEquals(AuthUiState.SignedOut(), vm.state.value)
        }

    @Test
    fun `starts signed in when session persisted`() =
        runTest(dispatcher) {
            val store = TokenStore(MapSettings())
            store.clientJwt = "client-jwt"
            store.sessionId = "sess_7"
            val vm = viewModel(store) { error("no network") }
            assertIs<AuthUiState.SignedIn>(vm.state.value)
        }

    @Test
    fun `full email to code to signed in flow`() =
        runTest(dispatcher) {
            val vm = viewModel(handler = happyPathHandler())

            vm.sendCode("burak@example.com")
            vm.state.first { it == AuthUiState.SignedOut(stage = SignInStage.CODE) }

            vm.verify("424242")
            vm.state.first { it is AuthUiState.SignedIn }
        }

    @Test
    fun `blank email is rejected locally`() =
        runTest(dispatcher) {
            val vm = viewModel { error("no network") }
            vm.sendCode("   ")
            assertEquals(
                AuthUiState.SignedOut(error = "Enter your email address"),
                vm.state.value,
            )
        }

    @Test
    fun `clerk error surfaces in state`() =
        runTest(dispatcher) {
            val vm =
                viewModel {
                    json(
                        """{"errors": [{"code": "form_identifier_not_found",
                            "long_message": "Couldn't find your account."}]}""",
                        HttpStatusCode.UnprocessableEntity,
                    )
                }
            vm.sendCode("nobody@example.com")
            val state = vm.state.first { it is AuthUiState.SignedOut && it.error != null }
            assertEquals(
                AuthUiState.SignedOut(error = "Couldn't find your account."),
                state,
            )
        }

    @Test
    fun `sign out returns to email stage`() =
        runTest(dispatcher) {
            val vm = viewModel(handler = happyPathHandler())
            vm.sendCode("burak@example.com")
            vm.state.first { it == AuthUiState.SignedOut(stage = SignInStage.CODE) }
            vm.verify("424242")
            vm.state.first { it is AuthUiState.SignedIn }

            vm.signOut()
            vm.state.first { it == AuthUiState.SignedOut() }
        }
}
