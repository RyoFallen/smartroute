package com.smartroute.traveler.config

// iOS simulator shares the host network namespace.
actual fun platformApiBaseUrl(): String = "http://localhost:3000"
