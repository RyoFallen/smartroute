package com.smartroute.traveler.data.storage

import com.russhwolf.settings.Settings

private const val KEY_APP_LANGUAGE = "app_language"

/** The two UI languages (spec §3.7). Device-local; never sent to the backend. */
enum class AppLanguage(
    val tag: String,
) {
    EN("en"),
    TR("tr"),
    ;

    companion object {
        fun fromTag(tag: String?): AppLanguage? = entries.firstOrNull { it.tag == tag }
    }
}

class LanguageStore(
    private val settings: Settings,
) {
    /** null = follow the device locale (no explicit choice yet). */
    var language: AppLanguage?
        get() = AppLanguage.fromTag(settings.getStringOrNull(KEY_APP_LANGUAGE))
        set(value) {
            if (value == null) {
                settings.remove(KEY_APP_LANGUAGE)
            } else {
                settings.putString(KEY_APP_LANGUAGE, value.tag)
            }
        }
}
