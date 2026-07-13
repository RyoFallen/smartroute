package com.smartroute.traveler.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.InterestEntryDto
import com.smartroute.traveler.domain.InterestCategory
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed interface InterestsUiState {
    data object Loading : InterestsUiState

    data object LoadFailed : InterestsUiState

    data class Editing(
        /** Every InterestCategory is present; unrated ones are neutral (0). */
        val ratings: Map<InterestCategory, Int>,
        val saving: Boolean = false,
        val saveFailed: Boolean = false,
        val saved: Boolean = false,
    ) : InterestsUiState
}

/**
 * Targeted interest editing after onboarding. Saves go through the same
 * full-replace endpoint the deck uses — one write path (spec).
 */
class InterestsViewModel(
    private val api: ApiClient,
) : ViewModel() {
    private val _state = MutableStateFlow<InterestsUiState>(InterestsUiState.Loading)
    val state: StateFlow<InterestsUiState> = _state

    fun load() {
        _state.value = InterestsUiState.Loading
        viewModelScope.launch {
            _state.value =
                try {
                    val stored =
                        api
                            .getMe()
                            .profile
                            ?.interests
                            .orEmpty()
                            .mapNotNull { entry ->
                                InterestCategory.fromSlug(entry.category)?.let { it to entry.rating }
                            }.toMap()
                    InterestsUiState.Editing(
                        ratings = InterestCategory.entries.associateWith { stored[it] ?: 0 },
                    )
                } catch (_: Exception) {
                    InterestsUiState.LoadFailed
                }
        }
    }

    fun setRating(
        category: InterestCategory,
        rating: Int,
    ) {
        val editing = _state.value as? InterestsUiState.Editing ?: return
        if (editing.saving) return
        _state.value =
            editing.copy(
                ratings = editing.ratings + (category to rating),
                saved = false,
                saveFailed = false,
            )
    }

    fun save() {
        val editing = _state.value as? InterestsUiState.Editing ?: return
        if (editing.saving) return
        _state.value = editing.copy(saving = true, saveFailed = false, saved = false)
        viewModelScope.launch {
            _state.value =
                try {
                    api.putInterests(
                        InterestCategory.entries.map {
                            InterestEntryDto(it.slug, editing.ratings[it] ?: 0)
                        },
                    )
                    editing.copy(saving = false, saved = true)
                } catch (_: Exception) {
                    editing.copy(saving = false, saveFailed = true)
                }
        }
    }
}
