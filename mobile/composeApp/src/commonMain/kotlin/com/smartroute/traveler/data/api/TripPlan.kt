package com.smartroute.traveler.data.api

import com.smartroute.traveler.domain.AttractionCategory
import kotlinx.serialization.Serializable

/** Subset of the shared Attraction schema (packages/shared/src/attractions.ts) the trip-plan screen needs. */
@Serializable
data class AttractionDto(
    val id: String,
    val name: String,
    val category: AttractionCategory,
    val lat: Double,
    val lon: Double,
    val description: String,
)

/** Mirrors the shared TripPlanCity schema — null name/empty mustGo when !available. */
@Serializable
data class TripPlanCityDto(
    val iata: String,
    val name: String?,
    val available: Boolean,
    val mustGo: List<AttractionDto>,
)

/** Mirrors the shared TripPlanResponse schema. */
@Serializable
data class TripPlanResponseDto(
    val tripId: String,
    val cities: List<TripPlanCityDto>,
)
