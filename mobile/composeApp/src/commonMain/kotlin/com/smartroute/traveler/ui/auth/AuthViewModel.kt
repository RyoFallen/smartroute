package com.smartroute.traveler.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.auth.ClerkAuthClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

enum class SignInStage { EMAIL, CODE }

/** UI resolves these to localized strings; [Server] carries Clerk's own text. */
sealed interface AuthError {
    data object EmailRequired : AuthError

    data object CodeRequired : AuthError

    data object StartOver : AuthError

    data object SendFailed : AuthError

    data object VerifyFailed : AuthError

    data class Server(
        val message: String,
    ) : AuthError
}

sealed interface AuthUiState {
    data class SignedOut(
        val stage: SignInStage = SignInStage.EMAIL,
        val busy: Boolean = false,
        val error: AuthError? = null,
    ) : AuthUiState

    data object SignedIn : AuthUiState
}

class AuthViewModel(
    private val authClient: ClerkAuthClient,
) : ViewModel() {
    private val _state =
        MutableStateFlow<AuthUiState>(
            if (authClient.isSignedIn) AuthUiState.SignedIn else AuthUiState.SignedOut(),
        )
    val state: StateFlow<AuthUiState> = _state

    private var signInId: String? = null

    fun sendCode(email: String) {
        val current = _state.value as? AuthUiState.SignedOut ?: return
        val trimmed = email.trim()
        if (trimmed.isEmpty()) {
            _state.value = current.copy(error = AuthError.EmailRequired)
            return
        }
        _state.value = current.copy(busy = true, error = null)
        viewModelScope.launch {
            try {
                signInId = authClient.startEmailCodeSignIn(trimmed)
                _state.value = AuthUiState.SignedOut(stage = SignInStage.CODE)
            } catch (e: Exception) {
                _state.value =
                    AuthUiState.SignedOut(
                        stage = SignInStage.EMAIL,
                        error = e.message?.let(AuthError::Server) ?: AuthError.SendFailed,
                    )
            }
        }
    }

    fun verify(code: String) {
        val current = _state.value as? AuthUiState.SignedOut ?: return
        val attemptId = signInId
        if (attemptId == null) {
            _state.value = AuthUiState.SignedOut(error = AuthError.StartOver)
            return
        }
        if (code.isBlank()) {
            _state.value = current.copy(error = AuthError.CodeRequired)
            return
        }
        _state.value = current.copy(busy = true, error = null)
        viewModelScope.launch {
            try {
                authClient.attemptCode(attemptId, code.trim())
                signInId = null
                _state.value = AuthUiState.SignedIn
            } catch (e: Exception) {
                _state.value =
                    AuthUiState.SignedOut(
                        stage = SignInStage.CODE,
                        error = e.message?.let(AuthError::Server) ?: AuthError.VerifyFailed,
                    )
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            authClient.signOut()
            signInId = null
            _state.value = AuthUiState.SignedOut()
        }
    }
}
