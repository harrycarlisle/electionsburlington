#!/usr/bin/env python3
"""Fixture QA for Breaking Now scoring, source filters and utility override.

These cases never write production data. They document accept / reject reasons.
"""

from __future__ import annotations

import datetime as dt
import sys
import unittest
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_breaking_now import diversify_top
from publish_breaking_briefs import update_existing_brief
from render_homepage import contextual_clock_label
from render_live_homepage import diverse_newest_items, selected_breaking_visible
from sources.cause import official_cause
from sources.model import quick_update
from sources.relevance import police_relevance
from sources.score import breaking_score, passes_breaking_threshold, recency_score
from sources.utility import choose_default_mode, is_critical_go, is_critical_road
from sources.verify import corroborate, cluster_updates
from story_lifecycle import is_resolved, lifecycle_status

TZ = ZoneInfo("America/Toronto")
NOW = dt.datetime(2026, 8, 26, 8, 15, tzinfo=TZ)


def item(**fields):
    fields.setdefault("publishedAt", (NOW - dt.timedelta(minutes=20)).isoformat())
    fields.setdefault("discoveredAt", NOW.isoformat())
    return quick_update(**fields)


class RecencyTests(unittest.TestCase):
    def test_bands(self):
        self.assertGreaterEqual(recency_score(NOW - dt.timedelta(minutes=10), NOW), 4.9)
        self.assertGreaterEqual(recency_score(NOW - dt.timedelta(minutes=50), NOW), 4.0)
        self.assertLess(recency_score(NOW - dt.timedelta(hours=8), NOW), 2.0)
        self.assertLess(recency_score(NOW - dt.timedelta(hours=20), NOW), 1.0)


class HomepageLifecycleTests(unittest.TestCase):
    def test_resolved_archive_story_remains_as_local_update(self):
        resolved = {
            "id": "ghent",
            "headline": "Police take man into custody after Ghent Avenue standoff",
            "url": "/stories/ghent/",
            "publishedAt": (NOW - dt.timedelta(hours=16)).isoformat(),
            "lastMeaningfulUpdate": (NOW - dt.timedelta(hours=1)).isoformat(),
            "status": "resolved",
            "lifecycleStatus": "resolved",
        }
        rows = selected_breaking_visible(
            {"mode": "local_update", "items": []},
            {"items": [resolved]},
            NOW,
        )
        self.assertEqual([row["id"] for row in rows], ["ghent"])

    def test_active_breaking_story_preempts_local_update(self):
        breaking = {
            "id": "active",
            "headline": "Police close Brant Street",
            "storyUrl": "/stories/active/",
            "publishedAt": (NOW - dt.timedelta(minutes=20)).isoformat(),
            "status": "breaking",
        }
        old = {
            "id": "older",
            "headline": "Earlier local update",
            "url": "/stories/older/",
            "publishedAt": (NOW - dt.timedelta(hours=2)).isoformat(),
        }
        rows = selected_breaking_visible(
            {"mode": "breaking", "items": [breaking]},
            {"items": [old]},
            NOW,
        )
        self.assertEqual([row["id"] for row in rows], ["active"])

    def test_archive_story_moves_into_newest_after_hero(self):
        hero = {
            "id": "hero",
            "headline": "Lead story",
            "url": "/stories/hero/",
            "image": "/assets/hero.png",
            "publishedAt": (NOW - dt.timedelta(hours=2)).isoformat(),
            "topic": "history",
        }
        ghent = {
            "id": "ghent",
            "headline": "Police take man into custody after Ghent Avenue standoff",
            "url": "/stories/ghent/",
            "lastMeaningfulUpdate": (NOW - dt.timedelta(hours=1)).isoformat(),
            "topic": "public-safety",
            "status": "resolved",
        }
        rows = diverse_newest_items(
            {"feature": [hero], "latest": []},
            {"items": [ghent]},
            hero,
            NOW,
        )
        self.assertEqual([row["id"] for row in rows], ["ghent"])


class UtilityOverrideTests(unittest.TestCase):
    def test_driving_default_when_quiet(self):
        self.assertEqual(choose_default_mode({
            "driving": {"title": "QEW → Toronto", "metric": "Light"},
            "go": {"headline": "On time"},
            "skyway": {"title": "Light"},
        }), "driving")

    def test_minor_go_delay_does_not_override(self):
        self.assertFalse(is_critical_go({"headline": "Lakeshore West delay", "detail": "Trains running 5 to 8 minutes late"}))
        self.assertEqual(choose_default_mode({
            "driving": {},
            "go": {"headline": "Minor delay", "detail": "+8 min"},
        }), "driving")

    def test_go_suspension_overrides(self):
        go = {"headline": "Lakeshore West", "detail": "Service suspended west of Oakville"}
        self.assertTrue(is_critical_go(go))
        self.assertEqual(choose_default_mode({"driving": {}, "go": go, "skyway": {}}), "go")

    def test_skyway_closure_overrides(self):
        sky = {"type": "closure", "title": "Skyway closed Toronto-bound", "facility": "mainline"}
        self.assertTrue(is_critical_road(sky, skyway=True))
        self.assertEqual(choose_default_mode({"driving": {}, "go": {}, "skyway": {**sky, "critical": True}}), "skyway")

    def test_on_ramp_is_not_critical(self):
        ramp = {
            "type": "closure",
            "facility": "on-ramp",
            "title": "QEW Toronto-bound on-ramp closed at Dorval Drive",
            "rawHeadline": "ALL LANES CLOSED.",
        }
        self.assertFalse(is_critical_road(ramp))


class PoliceFilterTests(unittest.TestCase):
    def test_halton_burlington_accepted(self):
        ok, reason = police_relevance("Halton Regional Police", item(
            headline="Halton police close Brant Street after collision",
            city="Burlington",
        ))
        self.assertTrue(ok, reason)

    def test_hamilton_qew_accepted(self):
        ok, reason = police_relevance("Hamilton Police Service", item(
            headline="Hamilton police close QEW after collision near the Skyway",
        ))
        self.assertTrue(ok, reason)

    def test_hamilton_neighbourhood_rejected(self):
        ok, reason = police_relevance("Hamilton Police Service", item(
            headline="Hamilton police investigate backyard theft on the Mountain",
            city="Hamilton",
        ))
        self.assertFalse(ok)
        self.assertEqual(reason, "hamilton-neighbourhood")

    def test_toronto_routine_rejected(self):
        ok, reason = police_relevance("Toronto Police Service", item(
            headline="Toronto police arrest someone in Scarborough",
            city="Toronto",
        ))
        self.assertFalse(ok)
        self.assertEqual(reason, "toronto-routine")

    def test_opp_highway_accepted(self):
        ok, reason = police_relevance("Ontario Provincial Police", item(
            headline="OPP: QEW closed near Burloak after collision",
        ))
        self.assertTrue(ok, reason)


class BreakingThresholdTests(unittest.TestCase):
    def test_burlington_collision_accepted(self):
        row = item(
            headline="Halton police close Brant Street after collision",
            category="PUBLIC SAFETY",
            sourceType="official",
            sourceName="Halton Regional Police",
            verificationStatus="verified",
            confidenceScore=5,
            city="Burlington",
        )
        ok, reason = passes_breaking_threshold(row, NOW)
        self.assertTrue(ok, reason)

    def test_go_suspension_accepted(self):
        row = item(
            headline="GO suspends Lakeshore West service through Burlington",
            category="TRANSIT",
            sourceType="official",
            sourceName="Metrolinx / GO Transit",
            verificationStatus="verified",
            confidenceScore=5,
        )
        ok, reason = passes_breaking_threshold(row, NOW)
        self.assertTrue(ok, reason)

    def test_qew_closure_accepted(self):
        row = item(
            headline="QEW Toronto-bound closed near Burloak",
            category="TRAFFIC",
            sourceType="official",
            sourceName="Ontario 511",
            verificationStatus="verified",
            confidenceScore=5,
        )
        ok, reason = passes_breaking_threshold(row, NOW)
        self.assertTrue(ok, reason)

    def test_reddit_only_rejected(self):
        row = item(
            headline="Lots of cops near Guelph Line and Upper Middle",
            sourceType="community",
            sourceName="Public Reddit · r/BurlingtonON",
            verificationStatus="community_lead",
            confidenceScore=1.5,
            label="UNVERIFIED",
            city="Burlington",
        )
        ok, reason = passes_breaking_threshold(row, NOW)
        self.assertFalse(ok)
        self.assertEqual(reason, "confidence-too-low")

    def test_reddit_plus_police_upgrades(self):
        lead = item(
            headline="Police everywhere near Brant and Upper Middle",
            sourceType="community",
            verificationStatus="community_lead",
            confidenceScore=1.5,
            location="Brant Street and Upper Middle Road",
            nearestIntersection="Brant Street and Upper Middle Road",
        )
        official = item(
            headline="Halton police responding near Brant Street and Upper Middle Road",
            sourceType="official",
            sourceName="Halton Regional Police",
            verificationStatus="verified",
            confidenceScore=5,
            location="Brant Street and Upper Middle Road",
            nearestIntersection="Brant Street and Upper Middle Road",
            eventType="police",
        )
        merged = corroborate(lead, [official])
        self.assertEqual(merged["verificationStatus"], "corroborated")
        self.assertGreaterEqual(float(merged["confidenceScore"]), 4)
        ok, reason = passes_breaking_threshold(merged, NOW)
        self.assertTrue(ok, reason)

    def test_city_tax_can_break(self):
        row = item(
            headline="City proposes unusually large Burlington tax increase",
            category="CITY HALL",
            sourceType="official",
            sourceName="City of Burlington",
            verificationStatus="verified",
            confidenceScore=5,
            city="Burlington",
        )
        ok, reason = passes_breaking_threshold(row, NOW)
        self.assertTrue(ok, reason)

    def test_hiring_notice_rejected(self):
        row = item(
            headline="Now hiring: Burlington is looking for temporary election officials",
            sourceType="official",
            sourceName="City of Burlington Election",
            verificationStatus="verified",
            confidenceScore=5,
            city="Burlington",
        )
        ok, reason = passes_breaking_threshold(row, NOW)
        self.assertFalse(ok)
        self.assertEqual(reason, "low-impact")

    def test_severe_weather_accepted(self):
        row = item(
            headline="Tornado warning for Halton including Burlington",
            category="WEATHER",
            sourceType="official",
            sourceName="Environment Canada",
            verificationStatus="verified",
            confidenceScore=5,
            severity="critical",
        )
        ok, reason = passes_breaking_threshold(row, NOW)
        self.assertTrue(ok, reason)

    def test_environmental_spill_accepted(self):
        row = item(
            headline="Major environmental spill reaches Burlington-area waterway",
            category="ENVIRONMENT",
            sourceType="official",
            sourceName="Halton Region",
            verificationStatus="verified",
            confidenceScore=5,
            city="Burlington",
        )
        ok, reason = passes_breaking_threshold(row, NOW)
        self.assertTrue(ok, reason)

    def test_celebrity_news_rejected(self):
        row = item(
            headline="Celebrity announces a surprise album on the red carpet",
            category="ENTERTAINMENT",
            sourceType="reporting",
            sourceName="National wire",
            verificationStatus="reported",
            confidenceScore=4,
            city="Los Angeles",
        )
        ok, reason = passes_breaking_threshold(row, NOW)
        self.assertFalse(ok)
        self.assertIn(reason, {"not-burlington-enough", "low-impact"})

    def test_stale_routine_drops(self):
        row = item(
            headline="Minor collision on New Street has been cleared",
            category="TRAFFIC",
            sourceType="official",
            sourceName="Ontario 511",
            verificationStatus="verified",
            confidenceScore=5,
            publishedAt=(NOW - dt.timedelta(hours=16)).isoformat(),
            updatedAt=(NOW - dt.timedelta(hours=16)).isoformat(),
        )
        ok, reason = passes_breaking_threshold(row, NOW)
        self.assertFalse(ok)
        self.assertEqual(reason, "breaking-window-expired")


class StoryLifecycleTests(unittest.TestCase):
    def test_custody_update_is_resolved(self):
        row = item(headline="Man taken into custody after Ghent Avenue standoff")
        self.assertTrue(is_resolved(row))
        self.assertEqual(lifecycle_status(row), "resolved")

    def test_cleared_road_is_resolved(self):
        row = item(headline="All lanes have reopened after QEW collision")
        self.assertTrue(is_resolved(row))

    def test_closed_road_is_still_active(self):
        row = item(headline="QEW closed near Centennial Parkway", status="closed")
        self.assertFalse(is_resolved(row))
        self.assertEqual(lifecycle_status(row), "active")

    def test_active_response_stays_active(self):
        row = item(headline="Police response underway on Brant Street", status="active")
        self.assertFalse(is_resolved(row))
        self.assertEqual(lifecycle_status(row), "active")

    def test_resolution_updates_existing_archive_row(self):
        existing = {
            "id": "example-incident",
            "headline": "Police response underway",
            "publishedAt": "2026-08-26T07:00:00-04:00",
            "status": "breaking",
        }
        incoming = {
            "headline": "Person taken into custody after police response",
            "updatedAt": "2026-08-26T08:00:00-04:00",
            "status": "resolved",
        }
        self.assertTrue(update_existing_brief(existing, incoming, NOW))
        self.assertEqual(existing["status"], "resolved")
        self.assertEqual(existing["lifecycleStatus"], "resolved")
        self.assertEqual(existing["lastMeaningfulUpdate"], "2026-08-26T08:00:00-04:00")

    def test_previous_day_clock_is_not_ambiguous(self):
        yesterday = NOW - dt.timedelta(days=1, minutes=53)
        self.assertTrue(contextual_clock_label(yesterday, NOW).startswith("YESTERDAY "))


class CauseAndDedupeTests(unittest.TestCase):
    def test_official_cause_not_reddit_speculation(self):
        self.assertEqual(official_cause("GO delayed due to a police investigation near Oakville", official=True), "Police investigation")
        self.assertEqual(official_cause("someone might be on the tracks", official=False), "")

    def test_cluster_same_collision(self):
        rows = [
            item(headline="Collision on QEW near Burloak", sourceName="Reddit", sourceType="community", confidenceScore=1.5),
            item(headline="QEW collision near Burloak Drive", sourceName="Halton Regional Police", sourceType="official", confidenceScore=5),
            item(headline="Collision reported on the QEW at Burloak", sourceName="CHCH", sourceType="reporting", confidenceScore=4),
            item(headline="QEW Toronto-bound blocked near Burloak", sourceName="Ontario 511", sourceType="official", confidenceScore=5),
        ]
        clustered = cluster_updates(rows)
        self.assertEqual(len(clustered), 1)
        self.assertGreaterEqual(len(clustered[0]["relatedSources"]), 2)

    def test_two_slots_prefer_different_categories(self):
        crime = breaking_score(item(
            headline="Halton police close Brant Street after collision",
            category="PUBLIC SAFETY",
            sourceType="official",
            sourceName="Halton Regional Police",
            verificationStatus="verified",
            confidenceScore=5,
            city="Burlington",
        ), NOW)
        weaker_crime = breaking_score(item(
            headline="Halton police investigate a neighbourhood theft",
            category="PUBLIC SAFETY",
            sourceType="official",
            sourceName="Halton Regional Police",
            verificationStatus="verified",
            confidenceScore=5,
            city="Burlington",
        ), NOW)
        traffic = breaking_score(item(
            headline="QEW Toronto-bound closed near Burloak",
            category="TRAFFIC",
            sourceType="official",
            sourceName="Ontario 511",
            verificationStatus="verified",
            confidenceScore=5,
        ), NOW)
        ranked = sorted([crime, weaker_crime, traffic], key=lambda row: row["breakingScore"], reverse=True)
        visible = diversify_top(ranked, 2)
        self.assertEqual(len(visible), 2)
        self.assertEqual(visible[0]["headline"], ranked[0]["headline"])
        categories = {row["category"] for row in visible}
        self.assertEqual(len(categories), 2)

    def test_two_emergencies_can_share_a_category(self):
        first = breaking_score(item(
            headline="Halton police close Brant Street after collision",
            category="PUBLIC SAFETY",
            sourceType="official",
            sourceName="Halton Regional Police",
            verificationStatus="verified",
            confidenceScore=5,
            city="Burlington",
        ), NOW)
        second = breaking_score(item(
            headline="Halton police evacuate a Burlington plaza after a fire",
            category="PUBLIC SAFETY",
            sourceType="official",
            sourceName="Halton Regional Police",
            verificationStatus="verified",
            confidenceScore=5,
            city="Burlington",
        ), NOW)
        other = breaking_score(item(
            headline="City posts a routine council agenda reminder",
            category="CITY HALL",
            sourceType="official",
            sourceName="City of Burlington",
            verificationStatus="verified",
            confidenceScore=5,
            city="Burlington",
        ), NOW)
        ranked = sorted([first, second, other], key=lambda row: row["breakingScore"], reverse=True)
        visible = diversify_top(ranked, 2)
        self.assertEqual(len(visible), 2)
        self.assertTrue(all("Halton police" in row["headline"] for row in visible))

    def test_score_not_just_newest(self):
        fresh_weak = breaking_score(item(
            headline="Restaurant on Brant posts a new lunch special",
            sourceType="reporting",
            confidenceScore=4,
            publishedAt=NOW.isoformat(),
        ), NOW)
        older_strong = breaking_score(item(
            headline="QEW Toronto-bound closed near Burloak",
            sourceType="official",
            confidenceScore=5,
            publishedAt=(NOW - dt.timedelta(hours=2)).isoformat(),
        ), NOW)
        self.assertGreater(older_strong["breakingScore"], fresh_weak["breakingScore"])


if __name__ == "__main__":
    raise SystemExit(unittest.main())
