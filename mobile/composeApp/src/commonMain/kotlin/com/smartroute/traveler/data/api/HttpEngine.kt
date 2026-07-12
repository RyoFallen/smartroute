package com.smartroute.traveler.data.api

import io.ktor.client.engine.HttpClientEngine

expect fun httpClientEngine(): HttpClientEngine
