package com.smartroute.traveler.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.ui.theme.GLASS_ALPHA_SUBTLE
import com.smartroute.traveler.ui.theme.SrColors
import com.smartroute.traveler.ui.theme.SrShapes

@Composable
fun GlassPill(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
    subtitle: String? = null,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val fill by animateColorAsState(
        if (selected) SrColors.Primary else Color.White.copy(alpha = GLASS_ALPHA_SUBTLE),
        tween(MOTION_MS, easing = EaseOut),
    )
    val contentColor by animateColorAsState(
        if (selected) SrColors.OnPrimary else SrColors.Foreground,
        tween(MOTION_MS, easing = EaseOut),
    )
    Row(
        modifier =
            modifier
                .pressScale(interactionSource)
                .clip(SrShapes.Pill)
                .background(fill, SrShapes.Pill)
                .border(BorderStroke(1.dp, GlassHighlight), SrShapes.Pill)
                .clickable(
                    interactionSource = interactionSource,
                    indication = null,
                    role = Role.Button,
                    onClick = onClick,
                ).padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leadingIcon != null) {
            Icon(leadingIcon, contentDescription = null, tint = contentColor, modifier = Modifier.size(18.dp))
        }
        if (subtitle == null) {
            Text(text, style = MaterialTheme.typography.labelLarge, color = contentColor)
        } else {
            Column {
                Text(text, style = MaterialTheme.typography.labelLarge, color = contentColor)
                Text(subtitle, style = MaterialTheme.typography.labelSmall, color = contentColor.copy(alpha = 0.8f))
            }
        }
    }
}
