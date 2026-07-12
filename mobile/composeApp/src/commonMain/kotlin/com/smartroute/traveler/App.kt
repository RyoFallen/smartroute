package com.smartroute.traveler

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.smartroute.traveler.config.AppConfig
import com.smartroute.traveler.ui.auth.AuthUiState
import com.smartroute.traveler.ui.auth.AuthViewModel
import com.smartroute.traveler.ui.auth.SignInScreen
import com.smartroute.traveler.ui.map.RouteMap

@Composable
fun App() {
    MaterialTheme {
        if (AppConfig.CLERK_PUBLISHABLE_KEY.isBlank()) {
            MissingConfigScreen()
        } else {
            AuthenticatedApp()
        }
    }
}

@Composable
private fun AuthenticatedApp() {
    val viewModel = viewModel { AuthViewModel(AppGraph.authClient) }
    val state by viewModel.state.collectAsState()
    when (val current = state) {
        is AuthUiState.SignedIn -> HomeScreen(onSignOut = viewModel::signOut)
        is AuthUiState.SignedOut ->
            SignInScreen(
                state = current,
                onSendCode = viewModel::sendCode,
                onVerify = viewModel::verify,
            )
    }
}

@Composable
private fun HomeScreen(onSignOut: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().safeDrawingPadding()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "SmartRoute Traveler",
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.padding(vertical = 16.dp),
            )
            TextButton(onClick = onSignOut) {
                Text("Sign out")
            }
        }
        RouteMap(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .weight(1f),
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
            text =
                "Clerk publishable key is not configured.\n" +
                    "Set AppConfig.CLERK_PUBLISHABLE_KEY to run the app.",
            style = MaterialTheme.typography.bodyLarge,
        )
    }
}
