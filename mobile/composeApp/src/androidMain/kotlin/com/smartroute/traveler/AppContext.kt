package com.smartroute.traveler

import android.content.Context

object AppContext {
    private var appContext: Context? = null

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    fun get(): Context = checkNotNull(appContext) { "AppContext.init(context) must be called before use" }
}
