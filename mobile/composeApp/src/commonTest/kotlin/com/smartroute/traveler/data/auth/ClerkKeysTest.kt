package com.smartroute.traveler.data.auth

import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

@OptIn(ExperimentalEncodingApi::class)
class ClerkKeysTest {
    private fun key(
        prefix: String,
        domain: String,
    ): String = prefix + Base64.encode("$domain$".encodeToByteArray())

    @Test
    fun `decodes test key to frontend api url`() {
        val publishableKey = key("pk_test_", "clerk.example.dev")
        assertEquals("https://clerk.example.dev", ClerkKeys.frontendApiUrl(publishableKey))
    }

    @Test
    fun `decodes live key to frontend api url`() {
        val publishableKey = key("pk_live_", "clerk.smartroute.app")
        assertEquals("https://clerk.smartroute.app", ClerkKeys.frontendApiUrl(publishableKey))
    }

    @Test
    fun `decodes real-format unpadded key`() {
        // Clerk strips base64 padding from publishable keys.
        assertEquals(
            "https://new-quetzal-43.clerk.accounts.dev",
            ClerkKeys.frontendApiUrl("pk_test_bmV3LXF1ZXR6YWwtNDMuY2xlcmsuYWNjb3VudHMuZGV2JA"),
        )
    }

    @Test
    fun `rejects non publishable key`() {
        assertFailsWith<IllegalArgumentException> { ClerkKeys.frontendApiUrl("sk_test_abc") }
    }

    @Test
    fun `rejects payload without dollar suffix`() {
        val bad = "pk_test_" + Base64.encode("clerk.example.dev".encodeToByteArray())
        assertFailsWith<IllegalArgumentException> { ClerkKeys.frontendApiUrl(bad) }
    }

    @Test
    fun `rejects empty payload`() {
        assertFailsWith<IllegalArgumentException> { ClerkKeys.frontendApiUrl("pk_test_") }
    }
}
