package com.smartroute.traveler

import com.smartroute.traveler.config.AppConfig
import com.smartroute.traveler.data.CityCatalog
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.httpClientEngine
import com.smartroute.traveler.data.auth.ClerkAuthClient
import com.smartroute.traveler.data.auth.ClerkKeys
import com.smartroute.traveler.data.storage.LanguageStore
import com.smartroute.traveler.data.storage.TokenStore
import com.smartroute.traveler.data.storage.createSettings

/** Manual DI for thesis scope (plan: Design Decision 5). */
object AppGraph {
    val tokenStore: TokenStore by lazy { TokenStore(createSettings()) }

    val languageStore: LanguageStore by lazy { LanguageStore(createSettings()) }

    val authClient: ClerkAuthClient by lazy {
        ClerkAuthClient(
            engine = httpClientEngine(),
            fapiUrl = ClerkKeys.frontendApiUrl(AppConfig.CLERK_PUBLISHABLE_KEY),
            tokenStore = tokenStore,
        )
    }

    val apiClient: ApiClient by lazy {
        ApiClient(
            engine = httpClientEngine(),
            baseUrl = AppConfig.apiBaseUrl,
            sessionJwtProvider = authClient::fetchSessionJwt,
        )
    }

    val cityCatalog: CityCatalog by lazy { CityCatalog(apiClient) }
}
