package com.smartroute.traveler.data.auth

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
internal data class SignInEnvelope(
    val response: SignInResource,
)

@Serializable
internal data class SignInResource(
    val id: String,
    val status: String,
    @SerialName("supported_first_factors")
    val supportedFirstFactors: List<SignInFactor>? = null,
    @SerialName("created_session_id")
    val createdSessionId: String? = null,
)

@Serializable
internal data class SignInFactor(
    val strategy: String,
    @SerialName("email_address_id")
    val emailAddressId: String? = null,
)

@Serializable
internal data class SessionTokenResponse(
    val jwt: String,
)

@Serializable
internal data class ClerkErrorEnvelope(
    val errors: List<ClerkError> = emptyList(),
)

@Serializable
internal data class ClerkError(
    val code: String? = null,
    val message: String? = null,
    @SerialName("long_message")
    val longMessage: String? = null,
)
