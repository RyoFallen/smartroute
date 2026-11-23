package com.smartroute.traveler.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import com.smartroute.traveler.ui.theme.SrColors

private const val WASH_RADIUS_FACTOR = 0.62f
private const val PEACH_Y_FRACTION = 0.35f

private fun DrawScope.wash(
    color: Color,
    center: Offset,
    radius: Float,
) = drawRect(
    Brush.radialGradient(
        colors = listOf(color, Color.Transparent),
        center = center,
        radius = radius,
    ),
)

@Composable
fun GlassBackground(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(SrColors.Background)
                .drawBehind {
                    val radius = maxOf(size.width, size.height) * WASH_RADIUS_FACTOR
                    wash(SrColors.WashCyan, Offset(0f, 0f), radius)
                    wash(SrColors.WashPeach, Offset(size.width, size.height * PEACH_Y_FRACTION), radius)
                    wash(SrColors.WashBlue, Offset(size.width / 2f, size.height), radius)
                },
    ) {
        content()
    }
}
