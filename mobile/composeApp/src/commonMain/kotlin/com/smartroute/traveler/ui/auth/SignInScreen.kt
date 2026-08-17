package com.smartroute.traveler.ui.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.auth_error_code_required
import smartroute_mobile.composeapp.generated.resources.auth_error_email_required
import smartroute_mobile.composeapp.generated.resources.auth_error_send_failed
import smartroute_mobile.composeapp.generated.resources.auth_error_session_expired
import smartroute_mobile.composeapp.generated.resources.auth_error_start_over
import smartroute_mobile.composeapp.generated.resources.auth_error_verify_failed
import smartroute_mobile.composeapp.generated.resources.sign_in_code_label
import smartroute_mobile.composeapp.generated.resources.sign_in_email_label
import smartroute_mobile.composeapp.generated.resources.sign_in_send_code
import smartroute_mobile.composeapp.generated.resources.sign_in_sending
import smartroute_mobile.composeapp.generated.resources.sign_in_subtitle
import smartroute_mobile.composeapp.generated.resources.sign_in_title
import smartroute_mobile.composeapp.generated.resources.sign_in_verify
import smartroute_mobile.composeapp.generated.resources.sign_in_verifying

@Composable
fun SignInScreen(
    state: AuthUiState.SignedOut,
    onSendCode: (String) -> Unit,
    onVerify: (String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .safeDrawingPadding()
                .padding(24.dp),
    ) {
        Text(
            text = stringResource(Res.string.sign_in_title),
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = stringResource(Res.string.sign_in_subtitle),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))
        when (state.stage) {
            SignInStage.EMAIL -> {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text(stringResource(Res.string.sign_in_email_label)) },
                    singleLine = true,
                    enabled = !state.busy,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { onSendCode(email) },
                    enabled = !state.busy,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        stringResource(
                            if (state.busy) Res.string.sign_in_sending else Res.string.sign_in_send_code,
                        ),
                    )
                }
            }
            SignInStage.CODE -> {
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it },
                    label = { Text(stringResource(Res.string.sign_in_code_label)) },
                    singleLine = true,
                    enabled = !state.busy,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { onVerify(code) },
                    enabled = !state.busy,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        stringResource(
                            if (state.busy) Res.string.sign_in_verifying else Res.string.sign_in_verify,
                        ),
                    )
                }
            }
        }
        state.error?.let { error ->
            Spacer(Modifier.height(12.dp))
            Text(
                text = errorText(error),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun errorText(error: AuthError): String =
    when (error) {
        AuthError.EmailRequired -> stringResource(Res.string.auth_error_email_required)
        AuthError.CodeRequired -> stringResource(Res.string.auth_error_code_required)
        AuthError.StartOver -> stringResource(Res.string.auth_error_start_over)
        AuthError.SendFailed -> stringResource(Res.string.auth_error_send_failed)
        AuthError.VerifyFailed -> stringResource(Res.string.auth_error_verify_failed)
        AuthError.SessionExpired -> stringResource(Res.string.auth_error_session_expired)
        is AuthError.Server -> error.message
    }
