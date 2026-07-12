package com.smartroute.traveler.i18n

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Every string key must have both an EN and a TR value (spec story 26). */
class StringResourceCompletenessTest {
    private val nameAttribute = Regex("<string name=\"([^\"]+)\">([^<]*)</string>")

    private fun keysWithValues(file: File): Map<String, String> =
        nameAttribute
            .findAll(file.readText())
            .associate { it.groupValues[1] to it.groupValues[2] }

    private fun resourcesDir(): File {
        var dir = File(System.getProperty("user.dir")).absoluteFile
        repeat(6) {
            val direct = dir.resolve("src/commonMain/composeResources")
            if (direct.exists()) return direct
            val nested = dir.resolve("composeApp/src/commonMain/composeResources")
            if (nested.exists()) return nested
            dir = dir.parentFile ?: error("composeResources not found")
        }
        error("composeResources not found from ${System.getProperty("user.dir")}")
    }

    @Test
    fun `every key exists in both EN and TR with a non-blank value`() {
        val base = resourcesDir()
        val en = keysWithValues(base.resolve("values/strings.xml"))
        val tr = keysWithValues(base.resolve("values-tr/strings.xml"))

        assertTrue(en.isNotEmpty(), "no EN strings found")
        assertEquals(en.keys, tr.keys, "EN and TR string keys differ")
        (en + tr).forEach { (key, value) ->
            assertTrue(value.isNotBlank(), "blank value for $key")
        }
    }
}
