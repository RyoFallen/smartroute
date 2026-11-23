package com.smartroute.traveler.ui.components

import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.smartroute.traveler.ui.theme.GLASS_ALPHA
import com.smartroute.traveler.ui.theme.SrColors
import com.smartroute.traveler.ui.theme.SrShapes

/** Corner shape for glass text fields (16 dp). */
val GlassTextFieldShape = SrShapes.SmallCard

/** Focused border primary, unfocused `SrColors.Border`, container white at [GLASS_ALPHA]. */
@Composable
fun glassTextFieldColors(): TextFieldColors {
    val container = Color.White.copy(alpha = GLASS_ALPHA)
    return OutlinedTextFieldDefaults.colors(
        focusedBorderColor = SrColors.Primary,
        unfocusedBorderColor = SrColors.Border,
        disabledBorderColor = SrColors.Border,
        focusedContainerColor = container,
        unfocusedContainerColor = container,
        disabledContainerColor = container,
        focusedLabelColor = SrColors.Primary,
        unfocusedLabelColor = SrColors.MutedForeground,
        disabledLabelColor = SrColors.MutedForeground,
        disabledTextColor = SrColors.Foreground,
        disabledPlaceholderColor = SrColors.MutedForeground,
        cursorColor = SrColors.Primary,
    )
}
