package com.smartroute.traveler.data.auth

import com.smartroute.traveler.data.storage.TokenStore
import io.ktor.client.HttpClient
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.forms.submitForm
import io.ktor.client.request.header
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.Parameters
import io.ktor.http.isSuccess
import io.ktor.http.parameters
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

class ClerkAuthException(
    val code: String,
    message: String,
) : Exception(message)

private const val STRATEGY_EMAIL_CODE = "email_code"

/**
 * Drives Clerk's Frontend API directly (native-app conventions):
 * every call carries `_is_native=1`, the persisted client JWT rides in the
 * `Authorization` request header, and each response may rotate it via the
 * `Authorization` response header. See the Phase 2 plan, Design Decision 1.
 */
class ClerkAuthClient(
    engine: HttpClientEngine,
    private val fapiUrl: String,
    private val tokenStore: TokenStore,
) {
    private val json = Json { ignoreUnknownKeys = true }

    private val http =
        HttpClient(engine) {
            expectSuccess = false
            install(ContentNegotiation) {
                json(this@ClerkAuthClient.json)
            }
        }

    val isSignedIn: Boolean
        get() = tokenStore.hasSession

    /** Creates a sign-in for [email] and sends the OTP. Returns the sign-in attempt id. */
    suspend fun startEmailCodeSignIn(email: String): String {
        val signIn =
            fapiPost(
                "/v1/client/sign_ins",
                parameters { append("identifier", email) },
            ).decodeSignIn()
        val factor =
            signIn.supportedFirstFactors.orEmpty().firstOrNull {
                it.strategy == STRATEGY_EMAIL_CODE && it.emailAddressId != null
            } ?: throw ClerkAuthException(
                "email_code_unavailable",
                "Email code sign-in is not available for this account",
            )
        fapiPost(
            "/v1/client/sign_ins/${signIn.id}/prepare_first_factor",
            parameters {
                append("strategy", STRATEGY_EMAIL_CODE)
                append("email_address_id", factor.emailAddressId!!)
            },
        )
        return signIn.id
    }

    /** Verifies the OTP; on success the Clerk session id is persisted. */
    suspend fun attemptCode(
        signInId: String,
        code: String,
    ) {
        val signIn =
            fapiPost(
                "/v1/client/sign_ins/$signInId/attempt_first_factor",
                parameters {
                    append("strategy", STRATEGY_EMAIL_CODE)
                    append("code", code)
                },
            ).decodeSignIn()
        val sessionId = signIn.createdSessionId
        if (signIn.status != "complete" || sessionId == null) {
            throw ClerkAuthException("sign_in_incomplete", "Sign-in incomplete (status: ${signIn.status})")
        }
        tokenStore.sessionId = sessionId
    }

    /** Fetches a fresh short-lived session JWT for backend `Authorization: Bearer` use. */
    suspend fun fetchSessionJwt(): String {
        val sessionId =
            tokenStore.sessionId
                ?: throw ClerkAuthException("no_session", "Not signed in")
        val response = fapiPost("/v1/client/sessions/$sessionId/tokens")
        return json.decodeFromString<SessionTokenResponse>(response.bodyAsText()).jwt
    }

    /** Ends the Clerk session (best effort) and always clears local tokens. */
    suspend fun signOut() {
        val sessionId = tokenStore.sessionId
        if (sessionId != null) {
            runCatching { fapiPost("/v1/client/sessions/$sessionId/remove") }
        }
        tokenStore.clear()
    }

    private suspend fun fapiPost(
        path: String,
        form: Parameters = Parameters.Empty,
    ): HttpResponse {
        val response =
            http.submitForm(url = "$fapiUrl$path", formParameters = form) {
                url.parameters.append("_is_native", "1")
                tokenStore.clientJwt?.let { header(HttpHeaders.Authorization, it) }
            }
        response.headers[HttpHeaders.Authorization]?.let { tokenStore.clientJwt = it }
        if (!response.status.isSuccess()) {
            throw response.toClerkException()
        }
        return response
    }

    private suspend fun HttpResponse.decodeSignIn(): SignInResource = json.decodeFromString<SignInEnvelope>(bodyAsText()).response

    private suspend fun HttpResponse.toClerkException(): ClerkAuthException {
        val error =
            runCatching { json.decodeFromString<ClerkErrorEnvelope>(bodyAsText()) }
                .getOrNull()
                ?.errors
                ?.firstOrNull()
        return ClerkAuthException(
            code = error?.code ?: "http_${status.value}",
            message = error?.longMessage ?: error?.message ?: "Clerk request failed (HTTP ${status.value})",
        )
    }
}
