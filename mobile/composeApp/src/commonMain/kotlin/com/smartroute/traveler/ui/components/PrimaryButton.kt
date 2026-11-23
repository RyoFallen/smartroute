package com.smartroute.traveler.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.ui.theme.SrColors
import com.smartroute.traveler.ui.theme.SrShapes

private val ButtonGradient = listOf(Color(0xFF0089AD), Color(0xFF007595), Color(0xFF006A86))

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: ImageVector? = null,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val shape = SrShapes.Card
    val fill: Brush =
        if (enabled) {
            Brush.linearGradient(ButtonGradient, start = Offset.Zero, end = Offset.Infinite)
        } else {
            SolidColor(SrColors.Muted)
        }
    val contentColor = if (enabled) SrColors.OnPrimary else SrColors.MutedForeground
    val shadowModifier =
        if (enabled) {
            Modifier.shadow(10.dp, shape, ambientColor = PrimaryGlow, spotColor = PrimaryGlow)
        } else {
            Modifier
        }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(52.dp)
                .pressScale(interactionSource)
                .then(shadowModifier)
                .clip(shape)
                .background(fill, shape)
                .clickable(
                    interactionSource = interactionSource,
                    indication = null,
                    enabled = enabled,
                    role = Role.Button,
                    onClick = onClick,
                ).padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leadingIcon != null) {
            Icon(leadingIcon, contentDescription = null, tint = contentColor, modifier = Modifier.size(20.dp))
        }
        Text(text, style = MaterialTheme.typography.titleMedium, color = contentColor)
    }
}
