package com.smartroute.traveler

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.smartroute.traveler.config.AppConfig
import com.smartroute.traveler.data.storage.AppLanguage
import com.smartroute.traveler.ui.auth.AuthUiState
import com.smartroute.traveler.ui.auth.AuthViewModel
import com.smartroute.traveler.ui.auth.SignInScreen
import com.smartroute.traveler.ui.i18n.LocalAppLocale
import com.smartroute.traveler.ui.navigation.MainTabsScaffold
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.missing_config

@Composable
fun App() {
    val languageStore = remember { AppGraph.languageStore }
    var language by remember { mutableStateOf(languageStore.language) }

    CompositionLocalProvider(LocalAppLocale provides language?.tag) {
        // key() re-resolves every string resource when the language changes.
        key(language) {
            MaterialTheme {
                if (AppConfig.CLERK_PUBLISHABLE_KEY.isBlank()) {
                    MissingConfigScreen()
                } else {
                    AuthenticatedApp(
                        language = language,
                        onLanguageSelected = {
                            languageStore.language = it
                            language = it
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun AuthenticatedApp(
    language: AppLanguage?,
    onLanguageSelected: (AppLanguage) -> Unit,
) {
    val viewModel = viewModel { AuthViewModel(AppGraph.authClient) }
    val state by viewModel.state.collectAsState()
    when (val current = state) {
        is AuthUiState.SignedIn ->
            MainTabsScaffold(
                language = language,
                onLanguageSelected = onLanguageSelected,
                onSignOut = viewModel::signOut,
            )
        is AuthUiState.SignedOut ->
            SignInScreen(
                state = current,
                onSendCode = viewModel::sendCode,
                onVerify = viewModel::verify,
            )
    }
}

@Composable
private fun MissingConfigScreen() {
    Box(
        modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = stringResource(Res.string.missing_config),
            style = MaterialTheme.typography.bodyLarge,
        )
    }
}
