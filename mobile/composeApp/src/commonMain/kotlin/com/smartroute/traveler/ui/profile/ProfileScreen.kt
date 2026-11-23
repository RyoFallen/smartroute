package com.smartroute.traveler.ui.profile

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.ui.components.GlassCard
import com.smartroute.traveler.ui.components.LocalBottomBarInset
import com.smartroute.traveler.ui.theme.SrColors
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.delete_account
import smartroute_mobile.composeapp.generated.resources.interests
import smartroute_mobile.composeapp.generated.resources.language
import smartroute_mobile.composeapp.generated.resources.preferences
import smartroute_mobile.composeapp.generated.resources.profile_signed_in_as
import smartroute_mobile.composeapp.generated.resources.sign_out
import smartroute_mobile.composeapp.generated.resources.tab_profile

/** The Profile settings hub (spec: email read-only, Preferences, Language,
 * Sign out; Interests and Delete account arrive with their tickets). */
@Composable
fun ProfileScreen(
    email: String?,
    onInterestsClick: () -> Unit,
    onPreferencesClick: () -> Unit,
    onLanguageClick: () -> Unit,
    onSignOut: () -> Unit,
    onDeleteAccountClick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(bottom = LocalBottomBarInset.current),
    ) {
        Text(
            text = stringResource(Res.string.tab_profile),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(16.dp),
        )
        email?.let {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                Text(
                    text = stringResource(Res.string.profile_signed_in_as),
                    style = MaterialTheme.typography.labelMedium,
                    color = SrColors.MutedForeground,
                )
                Text(text = it, style = MaterialTheme.typography.bodyLarge)
            }
        }
        GlassCard(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            SettingsRow(
                icon = Icons.Rounded.Favorite,
                label = stringResource(Res.string.interests),
                onClick = onInterestsClick,
            )
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp), color = SrColors.Border)
            SettingsRow(
                icon = Icons.Rounded.Tune,
                label = stringResource(Res.string.preferences),
                onClick = onPreferencesClick,
            )
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp), color = SrColors.Border)
            SettingsRow(
                icon = Icons.Rounded.Language,
                label = stringResource(Res.string.language),
                onClick = onLanguageClick,
            )
        }
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            TextButton(onClick = onSignOut) {
                Text(
                    text = stringResource(Res.string.sign_out),
                    style = MaterialTheme.typography.titleSmall,
                    color = SrColors.MutedForeground,
                )
            }
            TextButton(onClick = onDeleteAccountClick) {
                Text(
                    text = stringResource(Res.string.delete_account),
                    style = MaterialTheme.typography.titleSmall,
                    color = SrColors.Destructive,
                )
            }
        }
    }
}

@Composable
private fun SettingsRow(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = SrColors.Primary, modifier = Modifier.size(22.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f),
        )
        Icon(Icons.Rounded.ChevronRight, contentDescription = null, tint = SrColors.MutedForeground)
    }
}
