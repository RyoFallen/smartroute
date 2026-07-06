plugins {
    alias(libs.plugins.androidApplication) apply false
    alias(libs.plugins.kotlinMultiplatform) apply false
    alias(libs.plugins.composeMultiplatform) apply false
    alias(libs.plugins.composeCompiler) apply false
    alias(libs.plugins.ktlint) apply false
}

subprojects {
    apply(plugin = "org.jlleitschuh.gradle.ktlint")

    // Compose Multiplatform registers generated resource accessors (package
    // smartroute_mobile.composeapp.generated.resources) as source dirs, and
    // ktlint-gradle lints those registered dirs even though they live under
    // build/. Glob excludes (e.g. "**/build/**") evaluate against relative
    // paths and do not match generated source dirs registered this way, so a
    // predicate on the absolute file path is used instead.
    configure<org.jlleitschuh.gradle.ktlint.KtlintExtension> {
        filter {
            exclude { entry -> entry.file.toString().contains("generated") }
        }
    }
}
