package com.smartroute.traveler.ui.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.smartroute.traveler.ui.home.HomeScreen
import kotlinx.serialization.Serializable
import kotlin.reflect.KClass

@Serializable
object HomeRoute

@Serializable
object MyTripsRoute

@Serializable
object ExploreRoute

@Serializable
object ProfileRoute

private class TabItem(
    val route: Any,
    val routeClass: KClass<*>,
    val label: String,
    val icon: ImageVector,
)

private val tabs =
    listOf(
        TabItem(HomeRoute, HomeRoute::class, "Home", Icons.Filled.Home),
        TabItem(MyTripsRoute, MyTripsRoute::class, "My Trips", Icons.Filled.Place),
        TabItem(ExploreRoute, ExploreRoute::class, "Explore", Icons.Filled.Search),
        TabItem(ProfileRoute, ProfileRoute::class, "Profile", Icons.Filled.Person),
    )

@Composable
fun MainTabsScaffold(onSignOut: () -> Unit) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination

    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEach { tab ->
                    NavigationBarItem(
                        selected = currentDestination?.hasRoute(tab.routeClass) == true,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = HomeRoute,
            modifier = Modifier.fillMaxSize().padding(innerPadding),
        ) {
            composable<HomeRoute> { HomeScreen(onSignOut = onSignOut) }
            composable<MyTripsRoute> { StubScreen(title = "My Trips") }
            composable<ExploreRoute> { StubScreen(title = "Explore") }
            composable<ProfileRoute> { StubScreen(title = "Profile") }
        }
    }
}

@Composable
private fun StubScreen(title: String) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = title, style = MaterialTheme.typography.headlineSmall)
        Text(
            text = "Coming soon",
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
