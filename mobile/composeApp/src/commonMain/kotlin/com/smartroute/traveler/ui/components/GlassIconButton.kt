package com.smartroute.traveler.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.ui.theme.GLASS_ALPHA
import com.smartroute.traveler.ui.theme.SrColors

/** A round glass icon button: the header back circle and the onboarding rating controls. */
@Composable
fun GlassIconButton(
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    iconSize: Dp = 22.dp,
    tint: Color = SrColors.Foreground,
    enabled: Boolean = true,
    contentDescription: String? = null,
) {
    val interactionSource = remember { MutableInteractionSource() }
    Box(
        modifier =
            modifier
                .size(size)
                .pressScale(interactionSource)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = GLASS_ALPHA), CircleShape)
                .border(BorderStroke(1.dp, GlassHighlight), CircleShape)
                .clickable(
                    interactionSource = interactionSource,
                    indication = null,
                    enabled = enabled,
                    role = Role.Button,
                    onClick = onClick,
                ),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = contentDescription,
            tint = if (enabled) tint else SrColors.MutedForeground,
            modifier = Modifier.size(iconSize),
        )
    }
}
