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

    /**
     * The stored session stopped being valid while they were away.
     *
     * Kept distinct from [VerifyFailed] on purpose: the traveler did nothing
     * wrong and typed nothing wrong, and telling them a sign-in failed would
     * send them hunting for a mistake that is not there.
     */
    data object SessionExpired : AuthError

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

    init {
        // Any API call can discover that the session is gone, from any screen,
        // so the recovery has to live here rather than in whichever ViewModel
        // happened to make the call. Before this, `SignedIn` was decided once at
        // construction and only an explicit sign-out could undo it — which was
        // reachable only from behind the gate that was stuck (#33).
        viewModelScope.launch {
            authClient.sessionRevoked.collect { revoked ->
                // `signInId != null` means they have already asked for a code
                // and are part-way through entering it. A refresh failing for
                // the session they are replacing must not reset them to the
                // email stage and discard that attempt.
                //
                // Deliberately not "only while SignedIn": at launch the refresh
                // usually loses the race with construction, so by the time this
                // runs the state is already SignedOut — and that is precisely
                // the case that has to explain itself.
                if (revoked && signInId == null) {
                    signInId = null
                    _state.value = AuthUiState.SignedOut(error = AuthError.SessionExpired)
                }
            }
        }
    }

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
