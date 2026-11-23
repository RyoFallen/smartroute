package com.smartroute.traveler.ui.theme

import androidx.compose.ui.graphics.Color

const val GLASS_ALPHA = 0.72f
const val GLASS_ALPHA_SUBTLE = 0.55f

object SrColors {
    val Primary = Color(0xFF007595)
    val OnPrimary = Color(0xFFECFEFF)
    val Foreground = Color(0xFF0C0A09)
    val MutedForeground = Color(0xFF79716B)
    val Muted = Color(0xFFF5F5F4)
    val Secondary = Color(0xFFF4F4F5)
    val Border = Color(0xFFE7E5E4)
    val Destructive = Color(0xFFE7000B)

    val Background = Color(0xFFFBFBFA)
    val WashCyan = Color(0xFFBDEEF8)
    val WashPeach = Color(0xFFFBDCCD)
    val WashBlue = Color(0xFFCFE9F3)

    val GlassShadow = Color(0x12005F78)

    val Ramp: List<Color> =
        listOf(
            Color(0xFF53EAFD),
            Color(0xFF00B8DB),
            Color(0xFF0092B8),
            Color(0xFF007595),
            Color(0xFF005F78),
        )
}
