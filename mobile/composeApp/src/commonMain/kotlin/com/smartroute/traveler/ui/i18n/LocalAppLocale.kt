package com.smartroute.traveler.ui.i18n

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ProvidedValue

/**
 * Overrides the locale Compose resources resolve against, so the user's
 * in-app language choice wins over the device locale (JetBrains resource
 * environment pattern). Provide `null` to follow the system locale.
 */
expect object LocalAppLocale {
    val current: String
        @Composable get

    @Composable
    infix fun provides(value: String?): ProvidedValue<*>
}
