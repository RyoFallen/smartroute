package com.smartroute.traveler.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.ui.theme.GLASS_ALPHA
import com.smartroute.traveler.ui.theme.SrColors
import com.smartroute.traveler.ui.theme.SrShapes

private const val SELECTED_BORDER_ALPHA = 0.35f

internal val GlassHighlight = Color.White.copy(alpha = 0.9f)

/** rgba(0,117,149,.35) — the primary-tinted glow used for selected cards and the primary button. */
internal val PrimaryGlow = Color(0x59007595)

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    shape: Shape = SrShapes.Card,
    selected: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val borderColor = if (selected) SrColors.Primary.copy(alpha = SELECTED_BORDER_ALPHA) else GlassHighlight
    val shadowColor = if (selected) PrimaryGlow else SrColors.GlassShadow
    var card =
        modifier
            .shadow(12.dp, shape, ambientColor = shadowColor, spotColor = shadowColor)
            .clip(shape)
            .background(Color.White.copy(alpha = GLASS_ALPHA), shape)
            .border(BorderStroke(1.dp, borderColor), shape)
    if (onClick != null) {
        card =
            card
                .pressScale(interactionSource)
                .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
    }
    Column(modifier = card, content = content)
}
