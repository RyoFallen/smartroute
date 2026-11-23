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

/** Confirm-then-delete flow, same shape as account deletion. */
sealed interface TripDeleteUiState {
    data object Idle : TripDeleteUiState

    data object Confirming : TripDeleteUiState

    data object Deleting : TripDeleteUiState

    /** The delete failed; the trip is still there and the dialog offers a retry. */
    data object Failed : TripDeleteUiState

    /** Gone server-side — the screen should leave. */
    data object Deleted : TripDeleteUiState
}

/** A single saved trip's detail: loads via GET /trips/:id, deletes via DELETE /trips/:id. */
class TripDetailViewModel(
    private val api: ApiClient,
    private val tripId: String,
) : ViewModel() {
    private val _state = MutableStateFlow<TripDetailUiState>(TripDetailUiState.Loading)
    val state: StateFlow<TripDetailUiState> = _state

    private val _deleteState = MutableStateFlow<TripDeleteUiState>(TripDeleteUiState.Idle)
    val deleteState: StateFlow<TripDeleteUiState> = _deleteState

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

    fun requestDelete() {
        if (_deleteState.value == TripDeleteUiState.Idle) {
            _deleteState.value = TripDeleteUiState.Confirming
        }
    }

    fun cancelDelete() {
        if (_deleteState.value == TripDeleteUiState.Confirming || _deleteState.value == TripDeleteUiState.Failed) {
            _deleteState.value = TripDeleteUiState.Idle
        }
    }

    fun confirmDelete() {
        val current = _deleteState.value
        if (current != TripDeleteUiState.Confirming && current != TripDeleteUiState.Failed) return
        _deleteState.value = TripDeleteUiState.Deleting
        viewModelScope.launch {
            _deleteState.value =
                try {
                    api.deleteTrip(tripId)
                    TripDeleteUiState.Deleted
                } catch (_: Exception) {
                    TripDeleteUiState.Failed
                }
        }
    }
}
