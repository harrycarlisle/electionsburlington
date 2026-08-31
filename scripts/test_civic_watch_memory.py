#!/usr/bin/env python3
from update_civic_watch import active_beats, classify_item, matching_beats, relevant


def main():
    beats = active_beats(
        {'items':[{'id':'e-scooter-story','headline':'Burlington e-scooter rules','subjects':['e-scooter','safety']}]},
        {'beats':[{'id':'domcon','name':'DomCon','terms':['Dominion Society','DomCon']}]},
    )
    oakville = {'name':'Town of Oakville News and Notices','scope':'oakville'}
    hamilton = {'name':'City of Hamilton News Releases','scope':'hamilton'}
    assert matching_beats('Oakville e-scooter town hall', beats)[0]['id'] == 'e-scooter-story'
    assert relevant(oakville, 'Oakville holding e-scooter town hall Tuesday', '/town-hall/e-scooters', beats)
    assert relevant(hamilton, 'Dominion Society venue booking cancelled', '/news/domcon', beats)
    assert not relevant(hamilton, 'Hamilton opens neighbourhood splash pad', '/news/splash-pad', beats)
    item={'title':'Oakville holding e-scooter town hall Tuesday','description':'Residents can discuss the micromobility pilot.','url':'https://www.oakville.ca/example','importance':2}
    classify_item(item,beats)
    assert item['radarClass']=='Upcoming'
    assert 'e-scooter-story' in item['followUpTo']
    emergency={'title':'Emergency evacuation ordered after active fire','description':'Police warn residents to avoid the area.','url':'https://example.test','importance':5}
    classify_item(emergency,beats)
    assert emergency['radarClass']=='Breaking'
    print('civic watch story-memory checks passed')


if __name__=='__main__': main()
