package com.smartroute.traveler.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.domain.TripIntensity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed interface PreferencesUiState {
    data object Loading : PreferencesUiState

    data object LoadFailed : PreferencesUiState

    data class Editing(
        val intensity: TripIntensity,
        val wakeUpTime: String,
        val saving: Boolean = false,
        val saveFailed: Boolean = false,
        val saved: Boolean = false,
    ) : PreferencesUiState
}

/** Trip-pacing preferences: loads via GET /users/me (defaults when the profile
 * is null) and saves through the PUT /users/me upsert. */
class PreferencesViewModel(
    private val api: ApiClient,
) : ViewModel() {
    private val _state = MutableStateFlow<PreferencesUiState>(PreferencesUiState.Loading)
    val state: StateFlow<PreferencesUiState> = _state

    fun load() {
        _state.value = PreferencesUiState.Loading
        viewModelScope.launch {
            _state.value =
                try {
                    val profile = api.getMe().profile
                    PreferencesUiState.Editing(
                        intensity = TripIntensity.fromWire(profile?.intensity ?: "MODERATE"),
                        wakeUpTime = profile?.wakeUpTime ?: "09:00",
                    )
                } catch (_: Exception) {
                    PreferencesUiState.LoadFailed
                }
        }
    }

    fun setIntensity(intensity: TripIntensity) {
        val editing = _state.value as? PreferencesUiState.Editing ?: return
        if (editing.saving) return
        _state.value = editing.copy(intensity = intensity, saved = false, saveFailed = false)
    }

    fun setWakeUpTime(wakeUpTime: String) {
        val editing = _state.value as? PreferencesUiState.Editing ?: return
        if (editing.saving) return
        _state.value = editing.copy(wakeUpTime = wakeUpTime, saved = false, saveFailed = false)
    }

    fun save() {
        val editing = _state.value as? PreferencesUiState.Editing ?: return
        if (editing.saving) return
        _state.value = editing.copy(saving = true, saveFailed = false, saved = false)
        viewModelScope.launch {
            _state.value =
                try {
                    api.putPreferences(editing.intensity.wire, editing.wakeUpTime)
                    editing.copy(saving = false, saved = true)
                } catch (_: Exception) {
                    editing.copy(saving = false, saveFailed = true)
                }
        }
    }
}
