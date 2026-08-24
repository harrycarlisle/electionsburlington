#!/usr/bin/env python3
"""Run the civic monitor with Burlington-specific relevance rules.

The base monitor intentionally watches wider regional sources. This wrapper narrows
Metrolinx matching so generic GO Transit stories elsewhere in the GTA do not get
promoted as Burlington News merely because they mention a GO station.
"""
import update_civic_watch as monitor

# A Metrolinx story needs a Burlington-specific place/corridor reference. Generic
# terms such as "GO station", "GO Transit" and "Presto" are not enough by themselves.
monitor.TRANSIT_TERMS = (
    'burlington',
    'burlington station',
    'appleby',
    'burloak',
    'lakeshore west',
)
monitor.USER_AGENT = 'BurlingtonNews/1.0 (+https://electionsburlington.ca/)'

if __name__ == '__main__':
    monitor.main()
