package com.smartroute.traveler.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class InterestCategoryTest {
    // Thesis spec §3.3.1 — must stay byte-identical to the zod enum in
    // packages/shared/src/interests.ts. Slugs are stored data.
    private val expectedSlugs =
        listOf(
            "museums-galleries",
            "historical-sites",
            "nature-parks",
            "beaches-water",
            "food-dining",
            "nightlife-bars",
            "shopping",
            "art-architecture",
            "adventure-sports",
            "religious-sites",
            "local-culture",
            "photography-spots",
            "family-activities",
            "wellness-spa",
            "live-entertainment",
        )

    @Test
    fun `enum slugs match the shared vocabulary in spec order`() {
        assertEquals(expectedSlugs, InterestCategory.entries.map { it.slug })
    }

    @Test
    fun `every category has an icon`() {
        InterestCategory.entries.forEach { category ->
            assertTrue(category.icon.isNotBlank(), "${category.slug} has no icon")
        }
    }

    @Test
    fun `fromSlug resolves every slug and rejects unknowns`() {
        expectedSlugs.forEach { slug ->
            assertEquals(slug, InterestCategory.fromSlug(slug)?.slug)
        }
        assertEquals(null, InterestCategory.fromSlug("no-such-category"))
    }
}
