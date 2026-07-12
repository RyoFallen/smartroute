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
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import com.smartroute.traveler.data.storage.AppLanguage
import com.smartroute.traveler.ui.home.HomeScreen
import com.smartroute.traveler.ui.profile.LanguageScreen
import com.smartroute.traveler.ui.profile.ProfileScreen
import kotlinx.serialization.Serializable
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.coming_soon
import smartroute_mobile.composeapp.generated.resources.tab_explore
import smartroute_mobile.composeapp.generated.resources.tab_home
import smartroute_mobile.composeapp.generated.resources.tab_my_trips
import smartroute_mobile.composeapp.generated.resources.tab_profile
import kotlin.reflect.KClass

@Serializable
object HomeRoute

@Serializable
object MyTripsRoute

@Serializable
object ExploreRoute

@Serializable
object ProfileGraphRoute

@Serializable
object ProfileRoute

@Serializable
object LanguageRoute

private class TabItem(
    val route: Any,
    val routeClass: KClass<*>,
    val label: StringResource,
    val icon: ImageVector,
)

private val tabs =
    listOf(
        TabItem(HomeRoute, HomeRoute::class, Res.string.tab_home, Icons.Filled.Home),
        TabItem(MyTripsRoute, MyTripsRoute::class, Res.string.tab_my_trips, Icons.Filled.Place),
        TabItem(ExploreRoute, ExploreRoute::class, Res.string.tab_explore, Icons.Filled.Search),
        TabItem(ProfileGraphRoute, ProfileGraphRoute::class, Res.string.tab_profile, Icons.Filled.Person),
    )

@Composable
fun MainTabsScaffold(
    language: AppLanguage?,
    onLanguageSelected: (AppLanguage) -> Unit,
    onSignOut: () -> Unit,
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination

    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEach { tab ->
                    val label = stringResource(tab.label)
                    NavigationBarItem(
                        selected =
                            currentDestination?.hierarchy?.any { it.hasRoute(tab.routeClass) } == true,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = label) },
                        label = { Text(label) },
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
            composable<MyTripsRoute> { StubScreen(title = stringResource(Res.string.tab_my_trips)) }
            composable<ExploreRoute> { StubScreen(title = stringResource(Res.string.tab_explore)) }
            navigation<ProfileGraphRoute>(startDestination = ProfileRoute) {
                composable<ProfileRoute> {
                    ProfileScreen(onLanguageClick = { navController.navigate(LanguageRoute) })
                }
                composable<LanguageRoute> {
                    LanguageScreen(
                        selected = language,
                        onSelect = onLanguageSelected,
                        onBack = { navController.popBackStack() },
                    )
                }
            }
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
            text = stringResource(Res.string.coming_soon),
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
