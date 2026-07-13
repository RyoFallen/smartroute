package com.smartroute.traveler.ui.profile

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.cancel
import smartroute_mobile.composeapp.generated.resources.delete_account
import smartroute_mobile.composeapp.generated.resources.delete_account_confirm
import smartroute_mobile.composeapp.generated.resources.delete_account_error
import smartroute_mobile.composeapp.generated.resources.delete_account_message
import smartroute_mobile.composeapp.generated.resources.deleting
import smartroute_mobile.composeapp.generated.resources.retry

/** Explicit confirmation for GDPR erasure; cancel is always safe. */
@Composable
fun DeleteAccountDialog(
    state: DeleteAccountUiState,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
) {
    when (state) {
        is DeleteAccountUiState.Idle, DeleteAccountUiState.Deleted -> Unit
        is DeleteAccountUiState.Confirming, DeleteAccountUiState.Deleting, DeleteAccountUiState.Failed -> {
            val busy = state is DeleteAccountUiState.Deleting
            AlertDialog(
                onDismissRequest = { if (!busy) onCancel() },
                title = { Text(stringResource(Res.string.delete_account)) },
                text = {
                    Text(
                        if (state is DeleteAccountUiState.Failed) {
                            stringResource(Res.string.delete_account_error)
                        } else {
                            stringResource(Res.string.delete_account_message)
                        },
                    )
                },
                confirmButton = {
                    TextButton(onClick = onConfirm, enabled = !busy) {
                        Text(
                            text =
                                stringResource(
                                    when {
                                        busy -> Res.string.deleting
                                        state is DeleteAccountUiState.Failed -> Res.string.retry
                                        else -> Res.string.delete_account_confirm
                                    },
                                ),
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                },
                dismissButton = {
                    TextButton(onClick = onCancel, enabled = !busy) {
                        Text(stringResource(Res.string.cancel))
                    }
                },
            )
        }
    }
}
