package com.smartroute.traveler

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.ui.map.RouteMap

@Composable
fun App() {
    MaterialTheme {
        Column(modifier = Modifier.fillMaxSize().safeDrawingPadding()) {
            Text(
                text = "SmartRoute Traveler",
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.padding(16.dp),
            )
            RouteMap(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .weight(1f),
            )
        }
    }
}
