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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.Json

class ClerkAuthException(
    val code: String,
    message: String,
    /** Clerk's HTTP status, or null where the call never got a response. */
    val status: Int? = null,
    /**
     * Whether the body actually decoded as Clerk's error envelope.
     *
     * A status on its own does not prove Clerk answered. Clerk's Frontend API
     * sits behind a CDN, so a WAF challenge or a corporate proxy can return 403
     * with an HTML body — same status, no Clerk in it. Signing someone out on
     * that would take their session away over an interception they cannot see.
     */
    val fromClerk: Boolean = false,
) : Exception(message)

private const val STRATEGY_EMAIL_CODE = "email_code"

/**
 * The statuses that mean Clerk has disowned the stored session, as opposed to
 * merely failing to answer right now.
 *
 * Read from the status rather than the error code on purpose: a 5xx, a timeout
 * or a dropped connection must never sign anyone out, and only an answer from
 * Clerk itself can distinguish "this session is gone" from "ask me later".
 * Getting that backwards would log travelers out whenever their train went
 * through a tunnel — a worse bug than the one this exists to fix.
 */
private val SESSION_REVOKED_STATUSES = setOf(401, 403, 404)

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

    private val _sessionRevoked = MutableStateFlow(false)

    /**
     * Flips true when Clerk rejects the stored session outright.
     *
     * `isSignedIn` cannot carry this: it only reports whether tokens are
     * *present*, and they still are right up until we throw them away. Nothing
     * reconciled that against Clerk actually refusing them, which is how the app
     * came to sit forever on a retry that could not work (#33). This is the
     * signal that lets the auth state react instead.
     */
    val sessionRevoked: StateFlow<Boolean> = _sessionRevoked

    private var pendingEmail: String? = null

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
        pendingEmail = email
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
        tokenStore.email = pendingEmail
        // Otherwise the flag latches and the traveler who just signed in is
        // bounced straight back out again.
        _sessionRevoked.value = false
    }

    /**
     * Fetches a fresh short-lived session JWT for backend `Authorization: Bearer` use.
     *
     * The one place a stored session is put to Clerk and can come back refused,
     * so it is also the only place allowed to revoke one. `fapiPost` is shared
     * with the sign-in flow, where a 4xx is an ordinary wrong-code answer rather
     * than anything to do with an existing session.
     */
    suspend fun fetchSessionJwt(): String {
        val sessionId =
            tokenStore.sessionId
                ?: throw ClerkAuthException("no_session", "Not signed in")
        val response =
            try {
                fapiPost("/v1/client/sessions/$sessionId/tokens")
            } catch (e: ClerkAuthException) {
                // Only if the session that was refused is still the one we hold.
                // Refreshes run concurrently with whatever the traveler is doing
                // (Ktor's Auth plugin fires them on its own), so a 401 for a
                // session that has since been replaced by a successful sign-in
                // would otherwise throw the *new* session away.
                if (e.revokesSession() && tokenStore.sessionId == sessionId) revokeSession()
                throw e
            }
        return json.decodeFromString<SessionTokenResponse>(response.bodyAsText()).jwt
    }

    /**
     * Clerk saying this session is finished, as opposed to failing to answer.
     *
     * Both halves are required. The status narrows it to a refusal, and
     * `fromClerk` is what makes it Clerk's refusal rather than an intermediary's
     * — see [ClerkAuthException.fromClerk].
     */
    private fun ClerkAuthException.revokesSession(): Boolean = status in SESSION_REVOKED_STATUSES && fromClerk

    /**
     * Drops a session Clerk has already thrown away.
     *
     * Both halves matter: clearing alone leaves whatever screen the traveler was
     * on to fail on its own terms, which is the bug. The flag is what lets the
     * auth state send them somewhere they can act.
     */
    private fun revokeSession() {
        tokenStore.clear()
        _sessionRevoked.value = true
    }

    /** Ends the Clerk session (best effort) and always clears local tokens. */
    suspend fun signOut() {
        val sessionId = tokenStore.sessionId
        if (sessionId != null) {
            runCatching { fapiPost("/v1/client/sessions/$sessionId/remove") }
        }
        tokenStore.clear()
        // A deliberate sign-out is not a revocation to announce — the traveler
        // already knows, and leaving it set would mislabel the next sign-in
        // screen as "your session expired".
        _sessionRevoked.value = false
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
        // The envelope decoding, not just its contents: an empty `errors` array
        // is still Clerk answering, while an HTML challenge page is not.
        val envelope = runCatching { json.decodeFromString<ClerkErrorEnvelope>(bodyAsText()) }.getOrNull()
        val error = envelope?.errors?.firstOrNull()
        return ClerkAuthException(
            code = error?.code ?: "http_${status.value}",
            message = error?.longMessage ?: error?.message ?: "Clerk request failed (HTTP ${status.value})",
            status = status.value,
            fromClerk = envelope != null,
        )
    }
}
