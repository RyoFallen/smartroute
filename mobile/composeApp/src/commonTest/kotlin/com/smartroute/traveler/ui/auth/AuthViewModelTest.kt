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
                AuthUiState.SignedOut(error = AuthError.EmailRequired),
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
                AuthUiState.SignedOut(error = AuthError.Server("Couldn't find your account.")),
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

    @Test
    fun `a session Clerk has revoked sends the traveler back to sign in`() =
        runTest(dispatcher) {
            // #33: the app used to believe it was signed in forever, because
            // this state was decided once at construction and nothing could move
            // it back. Whatever screen they were on, they end up somewhere they
            // can act.
            val store = TokenStore(MapSettings())
            store.clientJwt = "client-jwt"
            store.sessionId = "sess_gone"
            val auth =
                ClerkAuthClient(
                    MockEngine { json("""{"errors": []}""", HttpStatusCode.NotFound) },
                    FAPI,
                    store,
                )
            val vm = AuthViewModel(auth)
            assertIs<AuthUiState.SignedIn>(vm.state.value)

            runCatching { auth.fetchSessionJwt() }

            val state = vm.state.first { it is AuthUiState.SignedOut }
            assertEquals(AuthUiState.SignedOut(error = AuthError.SessionExpired), state)
        }

    @Test
    fun `an expired session does not read as a failed sign-in attempt`() =
        runTest(dispatcher) {
            // They did nothing wrong and typed nothing wrong. Telling them their
            // sign-in failed would send them hunting for a mistake that is not
            // there.
            val store = TokenStore(MapSettings())
            store.clientJwt = "client-jwt"
            store.sessionId = "sess_gone"
            val auth =
                ClerkAuthClient(
                    MockEngine { json("""{"errors": []}""", HttpStatusCode.Unauthorized) },
                    FAPI,
                    store,
                )
            val vm = AuthViewModel(auth)

            runCatching { auth.fetchSessionJwt() }
            val state = vm.state.first { it is AuthUiState.SignedOut } as AuthUiState.SignedOut

            assertEquals(AuthError.SessionExpired, state.error)
            assertEquals(SignInStage.EMAIL, state.stage, "they have to start from their address")
        }

    @Test
    fun `a revocation that happened before the ViewModel existed still lands`() =
        runTest(dispatcher) {
            // The ticket's own scenario is a launch, where the refresh can lose
            // the race with construction. Pins the replay that makes this work,
            // so swapping the flow for a one-shot channel fails here rather than
            // silently reinstating the dead-end screen.
            val store = TokenStore(MapSettings())
            store.clientJwt = "client-jwt"
            store.sessionId = "sess_gone"
            val auth =
                ClerkAuthClient(
                    MockEngine { json("""{"errors": []}""", HttpStatusCode.NotFound) },
                    FAPI,
                    store,
                )
            runCatching { auth.fetchSessionJwt() }

            val vm = AuthViewModel(auth)

            // Waiting on the error, not merely on SignedOut: the store is
            // already cleared by now, so the *initial* state is SignedOut too
            // and would match instantly without proving anything.
            val state = vm.state.first { it is AuthUiState.SignedOut && it.error != null }
            assertEquals(AuthUiState.SignedOut(error = AuthError.SessionExpired), state)
        }

    @Test
    fun `a late revocation does not interrupt someone already signing in`() =
        runTest(dispatcher) {
            // They are at the code stage with a code in hand. A refresh failing
            // for the session they are replacing must not reset them to the
            // email stage and throw the attempt away.
            val store = TokenStore(MapSettings())
            val happyPath = happyPathHandler()
            val auth =
                ClerkAuthClient(
                    MockEngine { request ->
                        if (request.url.encodedPath.endsWith("/tokens")) {
                            json("""{"errors": []}""", HttpStatusCode.NotFound)
                        } else {
                            happyPath(request)
                        }
                    },
                    FAPI,
                    store,
                )
            val vm = AuthViewModel(auth)
            vm.sendCode("burak@example.com")
            vm.state.first { it == AuthUiState.SignedOut(stage = SignInStage.CODE) }

            store.sessionId = "sess_gone"
            runCatching { auth.fetchSessionJwt() }
            // Let the collector run, so this asserts the guard held rather than
            // just that nothing has happened yet.
            vm.state.first { it == AuthUiState.SignedOut(stage = SignInStage.CODE) }

            assertEquals(AuthUiState.SignedOut(stage = SignInStage.CODE), vm.state.value)
        }

    @Test
    fun `a Clerk outage leaves a signed-in traveler signed in`() =
        runTest(dispatcher) {
            val store = TokenStore(MapSettings())
            store.clientJwt = "client-jwt"
            store.sessionId = "sess_7"
            val auth =
                ClerkAuthClient(
                    MockEngine { json("""{"errors": []}""", HttpStatusCode.InternalServerError) },
                    FAPI,
                    store,
                )
            val vm = AuthViewModel(auth)

            runCatching { auth.fetchSessionJwt() }

            assertIs<AuthUiState.SignedIn>(vm.state.value)
        }
}
