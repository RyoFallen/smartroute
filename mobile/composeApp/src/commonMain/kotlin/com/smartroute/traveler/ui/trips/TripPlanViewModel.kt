package com.smartroute.traveler.ui.trips

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.TripPlanCityDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed interface TripPlanUiState {
    data object Loading : TripPlanUiState

    data object LoadFailed : TripPlanUiState

    data class Loaded(
        val cities: List<TripPlanCityDto>,
    ) : TripPlanUiState
}

/** A trip's must-go attractions per city: loads via GET /trips/:id/plan. */
class TripPlanViewModel(
    private val api: ApiClient,
    private val tripId: String,
) : ViewModel() {
    private val _state = MutableStateFlow<TripPlanUiState>(TripPlanUiState.Loading)
    val state: StateFlow<TripPlanUiState> = _state

    fun load() {
        _state.value = TripPlanUiState.Loading
        viewModelScope.launch {
            _state.value =
                try {
                    TripPlanUiState.Loaded(api.getTripPlan(tripId).cities)
                } catch (_: Exception) {
                    TripPlanUiState.LoadFailed
                }
        }
    }
}
