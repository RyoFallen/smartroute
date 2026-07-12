package com.smartroute.traveler.data.api

import kotlinx.serialization.Serializable

/** Mirrors the backend `{ error: { code, message } }` envelope, like the legacy Expo ApiClientError. */
class ApiError(
    val code: String,
    message: String,
    val status: Int,
) : Exception(message)

@Serializable
internal data class ApiErrorEnvelope(
    val error: ApiErrorBody? = null,
)

@Serializable
internal data class ApiErrorBody(
    val code: String? = null,
    val message: String? = null,
)
