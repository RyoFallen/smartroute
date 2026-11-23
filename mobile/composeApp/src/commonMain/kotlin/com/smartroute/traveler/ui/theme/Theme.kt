package com.smartroute.traveler.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val SrColorScheme =
    lightColorScheme(
        primary = SrColors.Primary,
        onPrimary = SrColors.OnPrimary,
        background = SrColors.Background,
        onBackground = SrColors.Foreground,
        surface = Color.White,
        onSurface = SrColors.Foreground,
        onSurfaceVariant = SrColors.MutedForeground,
        surfaceVariant = SrColors.Muted,
        // M3 derives these from primary (lavender/teal tints); pin them to theme neutrals.
        surfaceTint = Color.Transparent,
        surfaceBright = Color.White,
        surfaceDim = SrColors.Muted,
        surfaceContainerLowest = Color.White,
        surfaceContainerLow = Color.White,
        surfaceContainer = SrColors.Secondary,
        surfaceContainerHigh = SrColors.Muted,
        surfaceContainerHighest = SrColors.Secondary,
        secondaryContainer = SrColors.Secondary,
        outline = SrColors.Border,
        outlineVariant = SrColors.Border,
        error = SrColors.Destructive,
    )

private val SrMaterialShapes =
    Shapes(
        small = RoundedCornerShape(16.dp),
        medium = RoundedCornerShape(18.dp),
        large = RoundedCornerShape(18.dp),
    )

@Composable
fun SmartRouteTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SrColorScheme,
        typography = srTypography(),
        shapes = SrMaterialShapes,
        content = content,
    )
}
