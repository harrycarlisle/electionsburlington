#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from story_identity import newest_without_hero, normalize_url, same_story, unique_stories


def story(n: int, **overrides):
    item = {
        "id": f"story-{n}",
        "headline": f"Story {n}",
        "url": f"articles/story-{n}.html",
        "published": f"2026-08-{26 - n:02d}",
    }
    item.update(overrides)
    return item


def test_normalize_aliases():
    assert normalize_url("/stories/foo/") == normalize_url("/stories/foo")
    assert normalize_url("/stories/foo/") == normalize_url("articles/foo.html")
    assert normalize_url("https://burlingtonnews.ca/stories/foo/") == normalize_url("/articles/foo.html")
    assert normalize_url("/stories/foo/index.html") == normalize_url("/stories/foo/")
    assert normalize_url("articles/auto/foo.html") == normalize_url("/stories/foo/")


def test_case_a_hero_is_newest():
    latest = [story(1), story(2), story(3), story(4), story(5)]
    newest = newest_without_hero(latest, latest[0], 4)
    assert [item["id"] for item in newest] == ["story-2", "story-3", "story-4", "story-5"]


def test_case_b_hero_is_third():
    latest = [story(1), story(2), story(3), story(4), story(5)]
    newest = newest_without_hero(latest, latest[2], 4)
    assert [item["id"] for item in newest] == ["story-1", "story-2", "story-4", "story-5"]


def test_case_c_trailing_slash_alias():
    hero = {"id": "crime", "url": "/stories/how-bad-is-burlington-crime/"}
    other = {"headline": "How bad is Burlington's crime, really?", "url": "articles/how-bad-is-burlington-crime.html"}
    assert same_story(hero, other)
    newest = newest_without_hero([other, story(2), story(3)], hero, 4)
    assert [item["id"] for item in newest] == ["story-2", "story-3"]


def test_case_d_duplicate_feed_entries():
    latest = [
        story(2, url="/stories/school/"),
        {"headline": "Can a teacher take your phone?", "url": "articles/school.html"},
        story(3),
        story(4),
        story(5),
    ]
    newest = newest_without_hero(latest, story(1), 4)
    assert [item.get("id") or item["headline"] for item in newest] == ["story-2", "story-3", "story-4", "story-5"]
    assert len(unique_stories(latest)) == 4


def test_case_e_hero_rotates():
    crime, school, data, cafe, road = story(1), story(2), story(3), story(4), story(5)
    latest = [crime, school, data, cafe, road]
    with_crime_hero = newest_without_hero(latest, crime, 4)
    assert [item["id"] for item in with_crime_hero] == ["story-2", "story-3", "story-4", "story-5"]
    with_data_hero = newest_without_hero(latest, data, 4)
    assert [item["id"] for item in with_data_hero] == ["story-1", "story-2", "story-4", "story-5"]
    assert "story-1" in [item["id"] for item in with_data_hero]
    assert "story-3" not in [item["id"] for item in with_data_hero]


def test_empty_feed_does_not_pad():
    newest = newest_without_hero([story(1), story(2)], story(1), 4)
    assert [item["id"] for item in newest] == ["story-2"]


def test_do_not_slice_before_filter():
    latest = [story(1), story(2), story(3), story(4), story(5)]
    wrong = [item for item in latest[:4] if not same_story(item, latest[0])]
    right = newest_without_hero(latest, latest[0], 4)
    assert len(wrong) == 3
    assert len(right) == 4


if __name__ == "__main__":
    test_normalize_aliases()
    test_case_a_hero_is_newest()
    test_case_b_hero_is_third()
    test_case_c_trailing_slash_alias()
    test_case_d_duplicate_feed_entries()
    test_case_e_hero_rotates()
    test_empty_feed_does_not_pad()
    test_do_not_slice_before_filter()
    print("story identity tests passed")
