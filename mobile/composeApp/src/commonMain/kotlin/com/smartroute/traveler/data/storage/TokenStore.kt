package com.smartroute.traveler.data.storage

import com.russhwolf.settings.Settings

private const val KEY_CLIENT_JWT = "clerk_client_jwt"
private const val KEY_SESSION_ID = "clerk_session_id"

class TokenStore(
    private val settings: Settings,
) {
    var clientJwt: String?
        get() = settings.getStringOrNull(KEY_CLIENT_JWT)
        set(value) {
            if (value == null) settings.remove(KEY_CLIENT_JWT) else settings.putString(KEY_CLIENT_JWT, value)
        }

    var sessionId: String?
        get() = settings.getStringOrNull(KEY_SESSION_ID)
        set(value) {
            if (value == null) settings.remove(KEY_SESSION_ID) else settings.putString(KEY_SESSION_ID, value)
        }

    val hasSession: Boolean
        get() = clientJwt != null && sessionId != null

    fun clear() {
        settings.remove(KEY_CLIENT_JWT)
        settings.remove(KEY_SESSION_ID)
    }
}
