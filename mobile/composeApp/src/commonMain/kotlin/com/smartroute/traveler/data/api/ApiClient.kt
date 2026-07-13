package com.smartroute.traveler.data.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.auth.Auth
import io.ktor.client.plugins.auth.providers.BearerTokens
import io.ktor.client.plugins.auth.providers.bearer
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/**
 * Client for the SmartRoute Fastify backend. Bearer tokens are short-lived
 * Clerk session JWTs (~60 s): the Auth plugin caches the last one and a 401
 * triggers [sessionJwtProvider] again for a fresh token + one retry.
 */
class ApiClient(
    engine: HttpClientEngine,
    private val baseUrl: String,
    private val sessionJwtProvider: suspend () -> String,
) {
    private val json = Json { ignoreUnknownKeys = true }

    private val http =
        HttpClient(engine) {
            expectSuccess = false
            install(ContentNegotiation) {
                json(this@ApiClient.json)
            }
            install(Auth) {
                bearer {
                    loadTokens { BearerTokens(sessionJwtProvider(), null) }
                    refreshTokens { BearerTokens(sessionJwtProvider(), null) }
                    sendWithoutRequest { true }
                }
            }
        }

    suspend fun getTrips(): List<TripSummary> = get("/trips")

    suspend fun getMe(): ProfileEnvelopeDto = get("/users/me")

    suspend fun putInterests(interests: List<InterestEntryDto>): ProfileEnvelopeDto =
        put("/users/me/interests", ReplaceInterestsRequestDto(interests))

    suspend fun putPreferences(
        intensity: String,
        wakeUpTime: String,
    ): ProfileEnvelopeDto = put("/users/me", UpdatePreferencesRequestDto(intensity, wakeUpTime))

    /** GDPR erasure — the backend wipes local rows then the Clerk identity. */
    suspend fun deleteAccount() {
        val response = http.delete("$baseUrl/users/me")
        if (!response.status.isSuccess()) throw response.toApiError()
    }

    private suspend inline fun <reified T> get(path: String): T {
        val response = http.get("$baseUrl$path")
        if (!response.status.isSuccess()) throw response.toApiError()
        return response.body()
    }

    private suspend inline fun <reified B, reified T> put(
        path: String,
        body: B,
    ): T {
        val response =
            http.put("$baseUrl$path") {
                contentType(ContentType.Application.Json)
                setBody(body)
            }
        if (!response.status.isSuccess()) throw response.toApiError()
        return response.body()
    }

    private suspend fun HttpResponse.toApiError(): ApiError {
        val body =
            runCatching { json.decodeFromString<ApiErrorEnvelope>(bodyAsText()) }
                .getOrNull()
                ?.error
        return ApiError(
            code = body?.code ?: "UNKNOWN",
            message = body?.message ?: "HTTP ${status.value}",
            status = status.value,
        )
    }
}
