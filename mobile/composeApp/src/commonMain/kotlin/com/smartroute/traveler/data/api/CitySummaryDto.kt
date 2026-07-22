package com.smartroute.traveler.data.api

import kotlinx.serialization.Serializable

/** Mirrors the shared CitySummary schema (packages/shared/src/cities.ts). */
@Serializable
data class CitySummaryDto(
    val iata: String,
    val name: String,
    val country: String,
)
