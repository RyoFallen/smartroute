package com.smartroute.traveler.ui.trips

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.TripDetail
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed interface TripDetailUiState {
    data object Loading : TripDetailUiState

    data object LoadFailed : TripDetailUiState

    data class Loaded(
        val trip: TripDetail,
    ) : TripDetailUiState
}

/** A single saved trip's detail: loads via GET /trips/:id. */
class TripDetailViewModel(
    private val api: ApiClient,
    private val tripId: String,
) : ViewModel() {
    private val _state = MutableStateFlow<TripDetailUiState>(TripDetailUiState.Loading)
    val state: StateFlow<TripDetailUiState> = _state

    fun load() {
        _state.value = TripDetailUiState.Loading
        viewModelScope.launch {
            _state.value =
                try {
                    TripDetailUiState.Loaded(api.getTrip(tripId))
                } catch (_: Exception) {
                    TripDetailUiState.LoadFailed
                }
        }
    }
}
