package com.smartroute.traveler.ui.home

import com.smartroute.traveler.data.api.TripSummary
import kotlinx.datetime.LocalDate
import kotlinx.datetime.daysUntil

enum class Greeting { MORNING, AFTERNOON, EVENING }

private const val MORNING_FROM_HOUR = 5
private const val AFTERNOON_FROM_HOUR = 12
private const val EVENING_FROM_HOUR = 18
private const val DATE_PART_LENGTH = 10
private const val MAX_RECENT = 3

fun greetingFor(hour: Int): Greeting =
    when (hour) {
        in MORNING_FROM_HOUR until AFTERNOON_FROM_HOUR -> Greeting.MORNING
        in AFTERNOON_FROM_HOUR until EVENING_FROM_HOUR -> Greeting.AFTERNOON
        else -> Greeting.EVENING
    }

data class UpcomingTrip(
    val trip: TripSummary,
    val daysUntil: Int,
    val flightCount: Int,
)

data class HomeContent(
    val upcoming: UpcomingTrip?,
    val recent: List<TripSummary>,
)

// The backend sends ISO datetimes; only the date part matters. An unparseable value sorts
// as ancient, so a malformed trip lands in Recent rather than crashing Home.
private val UNPARSEABLE = LocalDate(1970, 1, 1)

private fun TripSummary.start(): LocalDate = runCatching { LocalDate.parse(startDate.take(DATE_PART_LENGTH)) }.getOrDefault(UNPARSEABLE)

fun homeContent(
    trips: List<TripSummary>,
    today: LocalDate,
): HomeContent {
    val nearest = trips.filter { it.start() >= today }.minByOrNull { it.start() }
    val upcoming =
        nearest?.let {
            UpcomingTrip(
                trip = it,
                daysUntil = today.daysUntil(it.start()),
                flightCount = (it.cities.size - 1).coerceAtLeast(0),
            )
        }
    val recent =
        trips
            .filter { it.id != nearest?.id }
            .sortedByDescending { it.start() }
            .take(MAX_RECENT)
    return HomeContent(upcoming, recent)
}
