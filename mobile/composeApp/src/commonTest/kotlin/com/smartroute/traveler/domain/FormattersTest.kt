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
}
