package com.smartroute.traveler.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.ui.theme.SrColors
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.retry

@Composable
fun RetryErrorState(
    message: String,
    onRetry: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(
                    Icons.Rounded.CloudOff,
                    contentDescription = null,
                    tint = SrColors.MutedForeground,
                    modifier = Modifier.size(36.dp),
                )
                Text(text = message, style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center)
                PrimaryButton(text = stringResource(Res.string.retry), onClick = onRetry)
            }
        }
    }
}
