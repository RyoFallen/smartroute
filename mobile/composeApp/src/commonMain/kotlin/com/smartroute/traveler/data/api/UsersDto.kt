package com.smartroute.traveler.data.api

import com.smartroute.traveler.domain.InterestCategory
import kotlinx.serialization.Serializable

// Mirrors the shared user schemas (packages/shared/src/users.ts).

@Serializable
data class InterestEntryDto(
    val category: String,
    val rating: Int,
)

@Serializable
data class UserProfileDto(
    val intensity: String,
    val wakeUpTime: String,
    val interests: List<InterestEntryDto>,
)

/** `profile == null` means the user has never written anything — the onboarding-gate signal. */
@Serializable
data class ProfileEnvelopeDto(
    val profile: UserProfileDto?,
)

@Serializable
data class ReplaceInterestsRequestDto(
    val interests: List<InterestEntryDto>,
)

/** The complete 15-entry payload for the full-replace endpoint; unrated categories are neutral. */
fun fullInterestSet(ratings: Map<InterestCategory, Int>): List<InterestEntryDto> =
    InterestCategory.entries.map { InterestEntryDto(it.slug, ratings[it] ?: 0) }

@Serializable
data class UpdatePreferencesRequestDto(
    val intensity: String,
    val wakeUpTime: String,
)
