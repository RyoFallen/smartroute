package com.smartroute.traveler.ui.home

import com.smartroute.traveler.data.api.TripSummary
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

private val TODAY = LocalDate(2026, 12, 1)

private fun trip(
    id: String,
    start: String,
    cities: List<String> = listOf("IST", "ROM"),
) = TripSummary(
    id = id,
    name = "Trip $id",
    startDate = start,
    endDate = start,
    cities = cities,
    totalPriceCents = 10_000,
)

class HomeContentTest {
    @Test
    fun `upcoming is the nearest trip starting today or later`() {
        val content =
            homeContent(
                listOf(trip("a", "2026-11-20"), trip("b", "2026-12-05"), trip("c", "2026-12-03T00:00:00.000Z")),
                TODAY,
            )
        val upcoming = assertNotNull(content.upcoming)
        assertEquals("c", upcoming.trip.id)
        assertEquals(2, upcoming.daysUntil)
    }

    @Test
    fun `a trip starting today is upcoming with zero days`() {
        val upcoming = assertNotNull(homeContent(listOf(trip("a", "2026-12-01")), TODAY).upcoming)
        assertEquals(0, upcoming.daysUntil)
    }

    @Test
    fun `past trips are never upcoming and fill recent newest first, at most three`() {
        val content =
            homeContent(
                listOf(
                    trip("a", "2026-10-01"),
                    trip("b", "2026-11-10"),
                    trip("c", "2026-09-01"),
                    trip("d", "2026-11-25"),
                ),
                TODAY,
            )
        assertNull(content.upcoming)
        assertEquals(listOf("d", "b", "a"), content.recent.map { it.id })
    }

    @Test
    fun `later upcoming trips fall into recent after the nearest one`() {
        val content = homeContent(listOf(trip("a", "2026-12-03"), trip("b", "2026-12-09")), TODAY)
        assertEquals("a", content.upcoming?.trip?.id)
        assertEquals(listOf("b"), content.recent.map { it.id })
    }

    @Test
    fun `flight count is cities minus one`() {
        val upcoming = assertNotNull(homeContent(listOf(trip("a", "2026-12-03", listOf("IST", "ROM", "PAR"))), TODAY).upcoming)
        assertEquals(2, upcoming.flightCount)
    }

    @Test
    fun `no trips gives empty content`() {
        val content = homeContent(emptyList(), TODAY)
        assertNull(content.upcoming)
        assertEquals(emptyList(), content.recent)
    }

    @Test
    fun `greetingFor boundaries`() {
        assertEquals(Greeting.EVENING, greetingFor(4))
        assertEquals(Greeting.MORNING, greetingFor(5))
        assertEquals(Greeting.MORNING, greetingFor(11))
        assertEquals(Greeting.AFTERNOON, greetingFor(12))
        assertEquals(Greeting.AFTERNOON, greetingFor(17))
        assertEquals(Greeting.EVENING, greetingFor(18))
    }
}
