package com.smartroute.traveler.data.storage

import com.russhwolf.settings.MapSettings
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TokenStoreTest {
    @Test
    fun `stores and reads tokens`() {
        val store = TokenStore(MapSettings())

        assertFalse(store.hasSession)

        store.clientJwt = "client-jwt"
        store.sessionId = "sess_123"

        assertEquals("client-jwt", store.clientJwt)
        assertEquals("sess_123", store.sessionId)
        assertTrue(store.hasSession)
    }

    @Test
    fun `clear removes everything`() {
        val store = TokenStore(MapSettings())
        store.clientJwt = "client-jwt"
        store.sessionId = "sess_123"

        store.clear()

        assertNull(store.clientJwt)
        assertNull(store.sessionId)
        assertFalse(store.hasSession)
    }

    @Test
    fun `setting null removes the value`() {
        val store = TokenStore(MapSettings())
        store.clientJwt = "client-jwt"
        store.clientJwt = null

        assertNull(store.clientJwt)
    }
}
