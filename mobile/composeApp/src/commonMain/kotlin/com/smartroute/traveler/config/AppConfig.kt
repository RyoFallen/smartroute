package com.smartroute.traveler.config

expect fun platformApiBaseUrl(): String

object AppConfig {
    /**
     * Clerk publishable key (public by design). Fill in from the Clerk
     * dashboard; blank means the app shows a configuration hint instead
     * of the sign-in form.
     */
    const val CLERK_PUBLISHABLE_KEY: String = "pk_test_bmV3LXF1ZXR6YWwtNDMuY2xlcmsuYWNjb3VudHMuZGV2JA"

    val apiBaseUrl: String get() = platformApiBaseUrl()
}
