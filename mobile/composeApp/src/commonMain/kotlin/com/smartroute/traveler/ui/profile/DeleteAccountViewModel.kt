package com.smartroute.traveler.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.storage.TokenStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed interface DeleteAccountUiState {
    data object Idle : DeleteAccountUiState

    data object Confirming : DeleteAccountUiState

    data object Deleting : DeleteAccountUiState

    /** The delete failed server-side; the session is still fully usable. */
    data object Failed : DeleteAccountUiState

    /** Account gone from both stores; local tokens cleared — land on sign-in. */
    data object Deleted : DeleteAccountUiState
}

class DeleteAccountViewModel(
    private val api: ApiClient,
    private val tokenStore: TokenStore,
) : ViewModel() {
    private val _state = MutableStateFlow<DeleteAccountUiState>(DeleteAccountUiState.Idle)
    val state: StateFlow<DeleteAccountUiState> = _state

    fun requestDelete() {
        if (_state.value == DeleteAccountUiState.Idle) {
            _state.value = DeleteAccountUiState.Confirming
        }
    }

    fun cancel() {
        if (_state.value == DeleteAccountUiState.Confirming || _state.value == DeleteAccountUiState.Failed) {
            _state.value = DeleteAccountUiState.Idle
        }
    }

    fun confirm() {
        val current = _state.value
        if (current != DeleteAccountUiState.Confirming && current != DeleteAccountUiState.Failed) return
        _state.value = DeleteAccountUiState.Deleting
        viewModelScope.launch {
            _state.value =
                try {
                    api.deleteAccount()
                    tokenStore.clear()
                    DeleteAccountUiState.Deleted
                } catch (_: Exception) {
                    DeleteAccountUiState.Failed
                }
        }
    }
}
