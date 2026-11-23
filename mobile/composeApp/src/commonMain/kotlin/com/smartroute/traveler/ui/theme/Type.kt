package com.smartroute.traveler.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import org.jetbrains.compose.resources.Font
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.figtree_medium
import smartroute_mobile.composeapp.generated.resources.figtree_regular
import smartroute_mobile.composeapp.generated.resources.figtree_semibold

@Composable
fun figtree(): FontFamily =
    FontFamily(
        Font(Res.font.figtree_regular, FontWeight.Normal),
        Font(Res.font.figtree_medium, FontWeight.Medium),
        Font(Res.font.figtree_semibold, FontWeight.SemiBold),
    )

private fun TextStyle.with(
    family: FontFamily,
    weight: FontWeight,
): TextStyle = copy(fontFamily = family, fontWeight = weight)

private fun TextStyle.body(
    family: FontFamily,
    weight: FontWeight,
    size: Float? = null,
): TextStyle {
    val s = size?.sp ?: fontSize
    return copy(fontFamily = family, fontWeight = weight, fontSize = s, lineHeight = s * 1.5f)
}

@Composable
fun srTypography(): Typography {
    val f = figtree()
    val base = Typography()
    return Typography(
        displayLarge = base.displayLarge.with(f, FontWeight.SemiBold),
        displayMedium = base.displayMedium.with(f, FontWeight.SemiBold),
        displaySmall = base.displaySmall.with(f, FontWeight.SemiBold),
        headlineLarge = base.headlineLarge.with(f, FontWeight.SemiBold),
        headlineMedium = base.headlineMedium.with(f, FontWeight.SemiBold),
        headlineSmall = base.headlineSmall.with(f, FontWeight.SemiBold),
        titleLarge = base.titleLarge.with(f, FontWeight.SemiBold),
        titleMedium = base.titleMedium.with(f, FontWeight.SemiBold),
        titleSmall = base.titleSmall.with(f, FontWeight.SemiBold),
        bodyLarge = base.bodyLarge.body(f, FontWeight.Normal, 17f),
        bodyMedium = base.bodyMedium.body(f, FontWeight.Normal, 15f),
        bodySmall = base.bodySmall.body(f, FontWeight.Normal),
        labelLarge = base.labelLarge.with(f, FontWeight.Medium),
        labelMedium = base.labelMedium.with(f, FontWeight.Medium),
        labelSmall = base.labelSmall.with(f, FontWeight.Medium),
    )
}
