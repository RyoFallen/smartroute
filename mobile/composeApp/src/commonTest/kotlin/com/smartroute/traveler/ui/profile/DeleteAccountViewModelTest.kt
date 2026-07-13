package com.smartroute.traveler.ui.profile

import com.russhwolf.settings.MapSettings
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.storage.TokenStore
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
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
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class DeleteAccountViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun signedInStore(): TokenStore =
        TokenStore(MapSettings()).apply {
            clientJwt = "client-jwt"
            sessionId = "sess_7"
            email = "burak@example.com"
        }

    private fun viewModel(
        store: TokenStore,
        handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData,
    ): DeleteAccountViewModel =
        DeleteAccountViewModel(
            api = ApiClient(MockEngine { handler(it) }, "https://api.example.dev") { "jwt" },
            tokenStore = store,
        )

    @Test
    fun `request shows confirmation and cancel is always safe`() =
        runTest(dispatcher) {
            val store = signedInStore()
            var called = false
            val vm =
                viewModel(store) {
                    called = true
                    respond("", HttpStatusCode.NoContent)
                }

            vm.requestDelete()
            assertEquals(DeleteAccountUiState.Confirming, vm.state.value)

            vm.cancel()
            assertEquals(DeleteAccountUiState.Idle, vm.state.value)
            assertFalse(called, "cancel must never call the API")
            assertTrue(store.hasSession)
        }

    @Test
    fun `confirm deletes the account and clears every local token`() =
        runTest(dispatcher) {
            val store = signedInStore()
            var method: HttpMethod? = null
            val vm =
                viewModel(store) { request ->
                    method = request.method
                    respond("", HttpStatusCode.NoContent)
                }

            vm.requestDelete()
            vm.confirm()
            vm.state.first { it is DeleteAccountUiState.Deleted }

            assertEquals(HttpMethod.Delete, method)
            assertFalse(store.hasSession)
            assertNull(store.email)
        }

    @Test
    fun `failure leaves the session usable and retry succeeds`() =
        runTest(dispatcher) {
            val store = signedInStore()
            var fail = true
            val vm =
                viewModel(store) {
                    if (fail) {
                        respond("""{"error":{}}""", HttpStatusCode.InternalServerError)
                    } else {
                        respond("", HttpStatusCode.NoContent)
                    }
                }

            vm.requestDelete()
            vm.confirm()
            vm.state.first { it is DeleteAccountUiState.Failed }
            assertTrue(store.hasSession, "failed delete must leave the account intact")

            fail = false
            vm.confirm()
            vm.state.first { it is DeleteAccountUiState.Deleted }
            assertFalse(store.hasSession)
        }
}
