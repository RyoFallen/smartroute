package com.smartroute.traveler.ui.profile

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.data.storage.AppLanguage
import com.smartroute.traveler.ui.components.GlassCard
import com.smartroute.traveler.ui.components.SubScreenHeader
import com.smartroute.traveler.ui.theme.SrColors
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.language
import smartroute_mobile.composeapp.generated.resources.language_english
import smartroute_mobile.composeapp.generated.resources.language_turkish

@Composable
fun LanguageScreen(
    selected: AppLanguage?,
    onSelect: (AppLanguage) -> Unit,
    onBack: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        SubScreenHeader(title = stringResource(Res.string.language), onBack = onBack)
        LanguageOption(
            label = stringResource(Res.string.language_english),
            selected = selected == AppLanguage.EN,
            onClick = { onSelect(AppLanguage.EN) },
        )
        LanguageOption(
            label = stringResource(Res.string.language_turkish),
            selected = selected == AppLanguage.TR,
            onClick = { onSelect(AppLanguage.TR) },
        )
    }
}

@Composable
private fun LanguageOption(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    GlassCard(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        selected = selected,
        onClick = onClick,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RadioButton(
                selected = selected,
                onClick = null,
                colors =
                    RadioButtonDefaults.colors(
                        selectedColor = SrColors.Primary,
                        unselectedColor = SrColors.MutedForeground,
                    ),
            )
            Text(
                text = label,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.padding(start = 12.dp),
            )
        }
    }
}
