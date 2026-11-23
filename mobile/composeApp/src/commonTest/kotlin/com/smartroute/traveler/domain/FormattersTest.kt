package com.smartroute.traveler.domain

import kotlin.test.Test
import kotlin.test.assertEquals

class FormattersTest {
    @Test
    fun formatsWholeAmount() {
        assertEquals("USD 847.00", formatPrice(84700, "USD"))
    }

    @Test
    fun formatsSubUnitAmount() {
        assertEquals("EUR 12.05", formatPrice(1205, "EUR"))
    }

    @Test
    fun formatsZero() {
        assertEquals("USD 0.00", formatPrice(0, "USD"))
    }

    @Test
    fun formatsNegativeAmount() {
        assertEquals("USD -8.05", formatPrice(-805, "USD"))
    }

    @Test
    fun formatsIsoDateAsJustTheDate() {
        assertEquals("2026-08-01", formatIsoDate("2026-08-01T08:00:00.000Z"))
    }

    @Test
    fun formatsIsoDateTimeAsDateAndTime() {
        assertEquals("2026-08-01 08:00", formatIsoDateTime("2026-08-01T08:00:00.000Z"))
    }

    @Test
    fun formatsIsoTimeAsJustTheTime() {
        assertEquals("08:00", formatIsoTime("2026-08-01T08:00:00.000Z"))
    }

    @Test
    fun readsAVisitSlotTimeOnTheCityOwnClock() {
        // The offset is the city's, so the wall clock in the string is already
        // local — no conversion, no device timezone.
        assertEquals("09:00", formatIsoTime("2026-07-01T09:00:00+03:00"))
    }

    @Test
    fun splitsADurationIntoHoursAndMinutes() {
        assertEquals(7 to 5, splitDuration(425))
        assertEquals(7 to 0, splitDuration(420))
        assertEquals(0 to 45, splitDuration(45))
    }
}
