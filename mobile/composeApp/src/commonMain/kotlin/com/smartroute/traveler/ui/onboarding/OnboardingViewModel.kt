package com.smartroute.traveler.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.fullInterestSet
import com.smartroute.traveler.domain.InterestCategory
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed interface OnboardingUiState {
    data object Loading : OnboardingUiState

    data object LoadFailed : OnboardingUiState

    data class Deck(
        val cardIndex: Int,
        val submitting: Boolean = false,
        val submitFailed: Boolean = false,
    ) : OnboardingUiState

    /** Profile exists server-side (or was just written) — enter the tabs. */
    data object Complete : OnboardingUiState
}

/**
 * The onboarding gate + swipe deck. The gate is pure server state:
 * `profile: null` from GET /users/me routes to the deck, anything else
 * straight to the tabs — so it survives reinstalls and new devices.
 */
class OnboardingViewModel(
    private val api: ApiClient,
) : ViewModel() {
    private val _state = MutableStateFlow<OnboardingUiState>(OnboardingUiState.Loading)
    val state: StateFlow<OnboardingUiState> = _state

    private val ratings = mutableMapOf<InterestCategory, Int>()

    fun refresh() {
        _state.value = OnboardingUiState.Loading
        viewModelScope.launch {
            _state.value =
                try {
                    if (api.getMe().profile == null) {
                        OnboardingUiState.Deck(cardIndex = 0)
                    } else {
                        OnboardingUiState.Complete
                    }
                } catch (_: Exception) {
                    OnboardingUiState.LoadFailed
                }
        }
    }

    /** Rate the current card: +1 like (swipe right), -1 dislike (left), 0 neutral (tap). */
    fun rateCurrent(rating: Int) {
        val deck = _state.value as? OnboardingUiState.Deck ?: return
        if (deck.submitting) return
        ratings[InterestCategory.entries[deck.cardIndex]] = rating
        if (deck.cardIndex + 1 < InterestCategory.entries.size) {
            _state.value = deck.copy(cardIndex = deck.cardIndex + 1, submitFailed = false)
        } else {
            submit(deck)
        }
    }

    /** "Skip for now": rates everything neutral (spec Implementation Decisions). */
    fun skipAll() {
        val deck = _state.value as? OnboardingUiState.Deck ?: return
        if (deck.submitting) return
        InterestCategory.entries.forEach { ratings[it] = 0 }
        submit(deck)
    }

    fun retrySubmit() {
        val deck = _state.value as? OnboardingUiState.Deck ?: return
        if (deck.submitting || !deck.submitFailed) return
        submit(deck)
    }

    private fun submit(deck: OnboardingUiState.Deck) {
        _state.value = deck.copy(submitting = true, submitFailed = false)
        viewModelScope.launch {
            _state.value =
                try {
                    api.putInterests(fullInterestSet(ratings))
                    OnboardingUiState.Complete
                } catch (_: Exception) {
                    deck.copy(submitting = false, submitFailed = true)
                }
        }
    }
}
