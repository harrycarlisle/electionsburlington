#!/usr/bin/env python3
"""Homepage diversity rerank should prefer mixed categories without forcing weak stories."""
from __future__ import annotations

import unittest

from rank_stories import adjusted_score, category_key, diversify, subject_keys


def story(item_id: str, score: int, topic: str, subjects: list[str] | None = None, **extra) -> dict:
    return {
        "id": item_id,
        "headline": item_id.replace("-", " "),
        "placementScore": score,
        "topic": topic,
        "subjects": subjects or [topic],
        "published": "2026-08-24",
        **extra,
    }


class DiversityTests(unittest.TestCase):
    def test_ribfest_is_not_lumped_with_cafe(self):
        cafe = story("nostalgia-games-cafe-closure", 85, "food", ["local-food", "cafe-closure"])
        ribfest = story("ribfest-2026", 78, "events", ["events", "ribfest"])
        self.assertFalse(subject_keys(cafe) & subject_keys(ribfest))

    def test_category_and_subject_from_explicit_fields(self):
        item = story("data-centre-not-ai", 86, "development", ["data-centre"])
        self.assertEqual(category_key(item), "development")
        self.assertIn("data-centre", subject_keys(item))

    def test_visible_cluster_avoids_three_development_stories(self):
        candidates = [
            story("schools", 88, "schools", ["school-policy"]),
            story("data-centre", 86, "development", ["data-centre"]),
            story("brant", 87, "development", ["730-brant"], evergreen=True),
            story("cafe", 85, "food", ["local-food"]),
            story("millcroft", 80, "development", ["millcroft"]),
        ]
        newest = diversify(candidates, 3, pool="newest")
        topics = [category_key(item) for item in newest]
        self.assertEqual(topics[0], "schools")
        self.assertIn("food", topics)
        self.assertLessEqual(topics.count("development"), 1)

    def test_same_subject_is_penalized_even_with_different_labels(self):
        selected = [story("data-centre-city", 90, "city-hall", ["data-centre"])]
        repeat = story("data-centre-biz", 88, "business", ["data-centre"])
        other = story("schools", 80, "schools", ["school-policy"])
        self.assertLess(adjusted_score(repeat, selected), adjusted_score(other, selected))

    def test_strong_repeat_can_still_win(self):
        selected = [story("data-centre", 90, "development", ["data-centre"])]
        strong_repeat = story("brant", 88, "development", ["730-brant"])
        weak_other = story("nature", 40, "nature", ["wildlife"])
        self.assertGreater(adjusted_score(strong_repeat, selected), adjusted_score(weak_other, selected))

    def test_exclude_ids(self):
        candidates = [
            story("hero", 94, "public-safety", ["crime"]),
            story("schools", 88, "schools"),
            story("food", 85, "food"),
        ]
        picked = diversify(candidates, 2, {"hero"})
        self.assertEqual([item["id"] for item in picked], ["schools", "food"])

    def test_picks_see_already_visible_development(self):
        newest = [story("data-centre", 86, "development", ["data-centre"])]
        candidates = [
            story("730-brant-vacant-building", 87, "development", ["730-brant"]),
            story("burlington-hotspots-0-24", 82, "sports", ["sports"]),
            story("skyway-tunnels", 82, "history", ["skyway"]),
            story("ribfest-2026", 78, "events", ["ribfest"]),
        ]
        picked = diversify(candidates, 3, {"data-centre"}, prior=newest)
        topics = [category_key(item) for item in picked]
        self.assertNotIn("730-brant-vacant-building", [item["id"] for item in picked])
        self.assertLessEqual(topics.count("development"), 0)
        self.assertIn("sports", topics)
        self.assertIn("history", topics)
        self.assertIn("events", topics)

    def test_technical_municipal_loses_when_events_are_close(self):
        selected = [
            story("crime", 88, "public-safety", ["crime"]),
            story("schools", 88, "schools"),
            story("data-centre", 86, "development", ["data-centre"]),
        ]
        ward = story("ward-change-2026", 80, "election", ["election"])
        ribfest = story("ribfest-2026", 78, "events", ["ribfest"])
        self.assertGreater(adjusted_score(ribfest, selected), adjusted_score(ward, selected))


if __name__ == "__main__":
    unittest.main()
