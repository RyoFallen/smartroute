package com.smartroute.traveler.data.auth

import com.russhwolf.settings.MapSettings
import com.smartroute.traveler.data.storage.TokenStore
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.client.request.forms.FormDataContent
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.formUrlEncode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

private const val FAPI = "https://clerk.example.dev"

class ClerkAuthClientTest {
    private fun MockRequestHandleScope.jsonResponse(
        body: String,
        status: HttpStatusCode = HttpStatusCode.OK,
        clientJwt: String? = null,
    ): HttpResponseData =
        respond(
            content = body,
            status = status,
            headers =
                if (clientJwt != null) {
                    headersOf(
                        HttpHeaders.ContentType to listOf("application/json"),
                        HttpHeaders.Authorization to listOf(clientJwt),
                    )
                } else {
                    headersOf(HttpHeaders.ContentType, "application/json")
                },
        )

    private fun HttpRequestData.formBody(): String = (body as FormDataContent).formData.formUrlEncode()

    private fun client(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData): Pair<ClerkAuthClient, TokenStore> {
        val store = TokenStore(MapSettings())
        return ClerkAuthClient(MockEngine { request -> handler(request) }, FAPI, store) to store
    }

    @Test
    fun `email code happy path signs in and stores session`() =
        runTest {
            val requests = mutableListOf<HttpRequestData>()
            val (auth, store) =
                client { request ->
                    requests += request
                    when {
                        request.url.encodedPath == "/v1/client/sign_ins" ->
                            jsonResponse(
                                """
                                {"response": {"id": "sia_1", "status": "needs_first_factor",
                                  "supported_first_factors": [
                                    {"strategy": "email_code", "email_address_id": "idn_9"}]}}
                                """.trimIndent(),
                                clientJwt = "client-jwt-1",
                            )
                        request.url.encodedPath.endsWith("/prepare_first_factor") ->
                            jsonResponse("""{"response": {"id": "sia_1", "status": "needs_first_factor"}}""")
                        request.url.encodedPath.endsWith("/attempt_first_factor") ->
                            jsonResponse(
                                """{"response": {"id": "sia_1", "status": "complete", "created_session_id": "sess_7"}}""",
                                clientJwt = "client-jwt-2",
                            )
                        else -> error("Unexpected call: ${request.url}")
                    }
                }

            val signInId = auth.startEmailCodeSignIn("burak@example.com")
            assertEquals("sia_1", signInId)
            assertEquals("client-jwt-1", store.clientJwt)

            auth.attemptCode(signInId, "424242")
            assertEquals("sess_7", store.sessionId)
            assertEquals("client-jwt-2", store.clientJwt)
            assertEquals("burak@example.com", store.email)
            assertTrue(auth.isSignedIn)

            // Native conventions: _is_native on every call, client JWT replayed once stored.
            assertTrue(requests.all { it.url.parameters["_is_native"] == "1" })
            assertNull(requests[0].headers[HttpHeaders.Authorization])
            assertEquals("client-jwt-1", requests[1].headers[HttpHeaders.Authorization])
            assertTrue(requests[0].formBody().contains("identifier=burak%40example.com"))
            assertTrue(requests[1].formBody().contains("email_address_id=idn_9"))
            assertTrue(requests[2].formBody().contains("code=424242"))
        }

    @Test
    fun `missing email code factor fails with dedicated error`() =
        runTest {
            val (auth, _) =
                client {
                    jsonResponse(
                        """
                        {"response": {"id": "sia_1", "status": "needs_first_factor",
                          "supported_first_factors": [{"strategy": "password"}]}}
                        """.trimIndent(),
                    )
                }
            val error =
                assertFailsWith<ClerkAuthException> { auth.startEmailCodeSignIn("burak@example.com") }
            assertEquals("email_code_unavailable", error.code)
        }

    @Test
    fun `clerk error envelope maps to exception`() =
        runTest {
            val (auth, _) =
                client {
                    jsonResponse(
                        """{"errors": [{"code": "form_identifier_not_found", "message": "Not found",
                            "long_message": "Couldn't find your account."}]}""",
                        status = HttpStatusCode.UnprocessableEntity,
                    )
                }
            val error =
                assertFailsWith<ClerkAuthException> { auth.startEmailCodeSignIn("nobody@example.com") }
            assertEquals("form_identifier_not_found", error.code)
            assertEquals("Couldn't find your account.", error.message)
        }

    @Test
    fun `incomplete attempt does not store a session`() =
        runTest {
            val (auth, store) =
                client { request ->
                    when {
                        request.url.encodedPath.endsWith("/attempt_first_factor") ->
                            jsonResponse("""{"response": {"id": "sia_1", "status": "needs_second_factor"}}""")
                        else -> error("Unexpected call: ${request.url}")
                    }
                }
            val error = assertFailsWith<ClerkAuthException> { auth.attemptCode("sia_1", "000000") }
            assertEquals("sign_in_incomplete", error.code)
            assertNull(store.sessionId)
        }

    @Test
    fun `fetchSessionJwt returns fresh jwt for stored session`() =
        runTest {
            val (auth, store) =
                client { request ->
                    assertEquals("/v1/client/sessions/sess_7/tokens", request.url.encodedPath)
                    jsonResponse("""{"object": "token", "jwt": "session-jwt"}""")
                }
            store.sessionId = "sess_7"
            assertEquals("session-jwt", auth.fetchSessionJwt())
        }

    @Test
    fun `fetchSessionJwt without session fails`() =
        runTest {
            val (auth, _) = client { error("No network expected") }
            val error = assertFailsWith<ClerkAuthException> { auth.fetchSessionJwt() }
            assertEquals("no_session", error.code)
        }

    @Test
    fun `signOut clears tokens even if the network call fails`() =
        runTest {
            val (auth, store) =
                client {
                    jsonResponse("""{"errors": []}""", status = HttpStatusCode.InternalServerError)
                }
            store.clientJwt = "client-jwt"
            store.sessionId = "sess_7"

            auth.signOut()

            assertNull(store.clientJwt)
            assertNull(store.sessionId)
        }
}
