package com.smartroute.traveler.data.storage

import android.content.Context
import com.russhwolf.settings.Settings
import com.russhwolf.settings.SharedPreferencesSettings
import com.smartroute.traveler.AppContext

actual fun createSettings(): Settings =
    SharedPreferencesSettings(
        AppContext.get().getSharedPreferences("smartroute_auth", Context.MODE_PRIVATE),
    )
