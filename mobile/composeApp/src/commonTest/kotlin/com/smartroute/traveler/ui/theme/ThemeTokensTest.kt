package com.smartroute.traveler.ui.theme

import androidx.compose.ui.graphics.Color
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ThemeTokensTest {
    @Test
    fun `palette matches the agreed preset`() {
        assertEquals(Color(0xFF007595), SrColors.Primary)
        assertEquals(Color(0xFF79716B), SrColors.MutedForeground)
        assertEquals(Color(0xFFFBFBFA), SrColors.Background)
    }

    @Test
    fun `contrast ratio of black on white is 21`() = assertEquals(21.0, contrastRatio(Color.Black, Color.White), 0.01)

    @Test
    fun `body text on glass meets AA over every wash`() {
        listOf(SrColors.Background, SrColors.WashCyan, SrColors.WashPeach, SrColors.WashBlue).forEach { bg ->
            val glass = Color.White.copy(alpha = GLASS_ALPHA).over(bg)
            assertTrue(contrastRatio(SrColors.Foreground, glass) >= 4.5)
        }
    }

    @Test
    fun `muted text on glass meets AA on the base and 3 to 1 on the strongest wash`() {
        val onBase = Color.White.copy(alpha = GLASS_ALPHA).over(SrColors.Background)
        val onPeach = Color.White.copy(alpha = GLASS_ALPHA).over(SrColors.WashPeach)
        assertTrue(contrastRatio(SrColors.MutedForeground, onBase) >= 4.5)
        assertTrue(contrastRatio(SrColors.MutedForeground, onPeach) >= 3.0)
    }
}
