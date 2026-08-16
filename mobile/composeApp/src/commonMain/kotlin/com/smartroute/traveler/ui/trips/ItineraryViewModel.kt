package com.smartroute.traveler.ui.trips

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.ItineraryCityDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed interface ItineraryUiState {
    data object Loading : ItineraryUiState

    data object LoadFailed : ItineraryUiState

    data class Loaded(
        val cities: List<ItineraryCityDto>,
    ) : ItineraryUiState
}

/** A trip's day-by-day Itinerary: loads via GET /trips/:id/itinerary. */
class ItineraryViewModel(
    private val api: ApiClient,
    private val tripId: String,
) : ViewModel() {
    private val _state = MutableStateFlow<ItineraryUiState>(ItineraryUiState.Loading)
    val state: StateFlow<ItineraryUiState> = _state

    fun load() {
        _state.value = ItineraryUiState.Loading
        viewModelScope.launch {
            _state.value =
                try {
                    ItineraryUiState.Loaded(api.getTripItinerary(tripId).cities)
                } catch (_: Exception) {
                    ItineraryUiState.LoadFailed
                }
        }
    }
}
