package com.smartroute.traveler.data.auth

import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

object ClerkKeys {
    /**
     * Derives the Frontend API origin from a Clerk publishable key.
     * `pk_test_<base64("clerk.example.com$")>` -> `https://clerk.example.com`
     */
    @OptIn(ExperimentalEncodingApi::class)
    fun frontendApiUrl(publishableKey: String): String {
        val encoded =
            publishableKey
                .removePrefix("pk_test_")
                .removePrefix("pk_live_")
        require(encoded != publishableKey && encoded.isNotBlank()) {
            "Not a Clerk publishable key: expected pk_test_… or pk_live_…"
        }
        val decoded = Base64.decode(encoded).decodeToString()
        require(decoded.endsWith("$")) { "Malformed Clerk publishable key payload" }
        return "https://${decoded.dropLast(1)}"
    }
}
