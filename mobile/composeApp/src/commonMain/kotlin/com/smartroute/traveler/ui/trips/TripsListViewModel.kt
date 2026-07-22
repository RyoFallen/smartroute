package com.smartroute.traveler.ui.trips

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.TripSummary
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed interface TripsListUiState {
    data object Loading : TripsListUiState

    data object LoadFailed : TripsListUiState

    data class Loaded(
        val trips: List<TripSummary>,
    ) : TripsListUiState
}

/** Saved trips: loads via GET /trips. An empty list is a normal Loaded state,
 * rendered as an empty-state message by the screen, not a separate case. */
class TripsListViewModel(
    private val api: ApiClient,
) : ViewModel() {
    private val _state = MutableStateFlow<TripsListUiState>(TripsListUiState.Loading)
    val state: StateFlow<TripsListUiState> = _state

    fun load() {
        _state.value = TripsListUiState.Loading
        viewModelScope.launch {
            _state.value =
                try {
                    TripsListUiState.Loaded(api.getTrips())
                } catch (_: Exception) {
                    TripsListUiState.LoadFailed
                }
        }
    }
}
