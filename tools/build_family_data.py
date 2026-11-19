"""Summaries for the CROWD Walking, Crash, Jaywalking, TraffCOCO and City pages.

Reads github.com/crowd-dataset/walking-yt (mapping.csv), car-crash-yt (crash_segments.csv,
mapping.csv), crowd-jaywalking (docs/*.csv, configs/jaywalking_rules.json, mapping.csv) and
TraffCOCO (mapping.csv and its class ontology) and crowd-city (its interactive figures), and writes
data/<page>.json for walking/, crash/, jaywalking/, traffcoco/ and city/. Name pages to build only those (python3 tools/build_family_data.py traffcoco).
Run from the repository root to refresh the pages:

    python3 tools/build_family_data.py
"""
import collections
import csv
import io
import json
import math
import os
import sys
import urllib.request
from datetime import date

RAW = 'https://raw.githubusercontent.com/crowd-dataset/{repo}/main/{path}'
COUNTRY_NAMES = {'Turkey': 'Türkiye'}  # as on the CROWD pages
WALK_TIME = {'0': 'Day', '1': 'Night', '2': 'Dawn or dusk', '-1': 'Unknown'}
CONTINENTS = ['North America', 'Europe', 'Asia', 'Oceania', 'South America', 'Africa']  # colour order
WALK_FACETS = {
    'Environment': ['Street', 'Market', 'Park or nature', 'Indoor', 'Square or plaza', 'Waterfront', 'Trail'],
    'Time of day': ['Day', 'Night', 'Dawn or dusk'],
}
CRASH_FACETS = {
    'Road': ['Motorway', 'Urban', 'Rural', 'Junction', 'Parking'],
    'Crash type': ['Single vehicle', 'Side impact', 'Rear end', 'Multi vehicle', 'Rollover', 'Head on', 'Near collision'],
    'Time of day': ['Day', 'Night', 'Dawn or dusk'],
    'Event': ['Collision', 'Near collision'],
    'Road users': ['Pedestrian', 'Cyclist', 'Motorcycle', 'Truck', 'Bus'],
}
WALK_SOURCE = {
    'timestamp_description': 'Author timestamp or chapter',
    'embedded_video': 'Text in the video',
    'both': 'Both',
    'none': 'No location evidence',
}


def fetch_text(repo, path):
    """A file from a crowd-dataset repo; FAMILY_DATA_DIR/<repo>/<path> is used instead when it exists."""
    local = os.path.join(os.environ.get('FAMILY_DATA_DIR', ''), repo, path)
    if os.environ.get('FAMILY_DATA_DIR') and os.path.exists(local):
        with open(local, encoding='utf-8') as handle:
            return handle.read()
    with urllib.request.urlopen(RAW.format(repo=repo, path=path), timeout=300) as response:
        return response.read().decode('utf-8')


def fetch_csv(repo, path):
    csv.field_size_limit(sys.maxsize)
    return list(csv.DictReader(io.StringIO(fetch_text(repo, path))))


def crowd_hours_by_country():
    """Hours of CROWD driving footage per country, from the country table in the crowd README."""
    text = fetch_text('crowd', 'README.md')
    start = text.index('<summary><b>All ')
    lines = []
    for line in text[start:].split('\n'):
        if line.startswith('|'):
            lines.append(line)
        elif lines:
            break  # the countries table has ended
    header = [cell.strip() for cell in lines[0].strip('|').split('|')]
    name_at, hours_at = header.index('Country'), header.index('Footage (h)')
    hours = {}
    for line in lines[2:]:
        cells = [cell.strip() for cell in line.strip('|').split('|')]
        if len(cells) <= hours_at:
            break
        name = ''.join(char for char in cells[name_at] if not 0x1F1E6 <= ord(char) <= 0x1F1FF).strip()
        hours[country(name)] = float(cells[hours_at].replace(',', '') or 0)
    return hours


def quantiles(values, marks=(0.05, 0.25, 0.5, 0.75, 0.95)):
    ordered = sorted(values)
    return [round(ordered[min(len(ordered) - 1, int(mark * (len(ordered) - 1) + 0.5))], 1) for mark in marks]


def share_curve(amounts):
    """Cumulative share (%) of the total held by the largest N contributors, sampled for drawing."""
    ordered = sorted(amounts, reverse=True)
    total = sum(ordered) or 1
    curve, running = [], 0
    step = max(1, len(ordered) // 160)
    for rank, value in enumerate(ordered, start=1):
        running += value
        if rank <= 25 or rank % step == 0 or rank == len(ordered):
            curve.append([rank, round(running / total * 100, 2)])
    return curve


def parse_list(text):
    """Bracket lists as written by the pipelines: JSON-like, but strings are unquoted."""
    text = (text or '').strip()
    if not text or text == '[]':
        return []
    try:
        return json.loads(text)
    except ValueError:
        pass
    out, stack, token = [], [], ''
    for char in text:
        if char == '[':
            stack.append([])
        elif char in ',]':
            if token.strip():
                stack[-1].append(token.strip())
            token = ''
            if char == ']':
                done = stack.pop()
                if stack:
                    stack[-1].append(done)
                else:
                    out = done
        else:
            token += char
    return out


def leaf_count(value):
    """Number of values in a list nested to any depth."""
    return sum(leaf_count(item) for item in value) if isinstance(value, list) else 1


LABELS = {
    'model_error_terminal': 'Model error', 'video_unavailable': 'Video unavailable',
    'front_to_rear_or_rear_to_front': 'Front to rear', 'not_collision_with_motor_vehicle_in_transport': 'Not with a vehicle in transport',
    'motor_vehicle_in_transport': 'Motor vehicle in transport', 'rollover_overturn': 'Rollover or overturn',
    'fire_explosion': 'Fire or explosion', 'thrown_or_falling_object': 'Thrown or falling object',
    'ran_off_roadway_right': 'Ran off road, right', 'impact_attenuator_crash_cushion': 'Crash cushion',
    'head_on': 'Head on', 'traffic_signal_support': 'Traffic signal support',
    'cctv': 'CCTV', 'suv': 'SUV', 'park_nature': 'Park or nature', 'square_plaza': 'Square or plaza',
    'snow_ice': 'Snow or ice', 'dawn_dusk': 'Dawn or dusk', 'near_collision': 'Near collision',
}


def label(value):
    if not value:
        return 'Unknown'
    key = value.strip().lower().replace(' ', '_')
    return LABELS.get(key, value.replace('_', ' ').strip().capitalize())


def ranked(counter, limit=None):
    return [[name, round(value, 1) if isinstance(value, float) else value] for name, value in counter.most_common(limit)]


def histogram(values, edges):
    counts = [0] * (len(edges) - 1)
    for value in values:
        for index in range(len(edges) - 1):
            if edges[index] <= value < edges[index + 1] or (index == len(edges) - 2 and value >= edges[-1]):
                counts[index] += 1
                break
    return counts


def country(name):
    return COUNTRY_NAMES.get(name, name)


def place(row):
    """'Locality, State, Country' for the map's tooltip; the state tells same-named towns apart."""
    state = row.get('state', '') if row.get('state', '') not in ('', row['locality']) else ''
    return ', '.join(part for part in [row['locality'], state, country(row['country'])] if part)


def merge_places(points, within_km=50):
    """One dot per place: rows with the same name closer than within_km join at their weighted centre.
    A point is [lat, lon, amount, name, per-category amounts (one list per facet)]."""
    merged, by_name = [], collections.defaultdict(list)
    for lat, lon, value, name, facets in sorted(points, key=lambda point: -point[2]):
        for dot in by_name[name]:
            if haversine(dot[0], dot[1], lat, lon) < within_km:
                total = dot[2] + value
                if total > 0:
                    dot[0] = (dot[0] * dot[2] + lat * value) / total
                    dot[1] = (dot[1] * dot[2] + lon * value) / total
                dot[2] = total
                dot[4] = [[a + b for a, b in zip(mine, theirs)] for mine, theirs in zip(dot[4], facets)]
                break
        else:
            merged.append([lat, lon, value, name, [list(values) for values in facets]])
            by_name[name].append(merged[-1])
    rounded = lambda value: round(value, 2) if isinstance(value, float) else value
    return [[round(lat, 2), round(lon, 2), rounded(value), name, [[rounded(v) for v in values] for values in facets]]
            for lat, lon, value, name, facets in merged]


def facet_counts(facets, amounts):
    """amounts: {(facet, category): amount} -> one list per facet, in the facet's category order."""
    return [[amounts.get((facet, category), 0) for category in categories] for facet, categories in facets.items()]


def monthly(dates, months=30):
    """Uploads per month for the last `months` months, with everything earlier in one 'Earlier' bar."""
    counts = collections.Counter(dates)
    if not counts:
        return []
    last = max(counts)
    year, month = int(last[:4]), int(last[5:7])
    series = []
    for _ in range(months):
        series.append(f'{year:04d}-{month:02d}')
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    series.reverse()
    earlier = sum(value for key, value in counts.items() if key < series[0])
    return ([['Earlier', earlier]] if earlier else []) + [[key, counts.get(key, 0)] for key in series]


def haversine(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def walking():
    rows = fetch_csv('walking-yt', 'mapping.csv')
    segments = seconds = 0
    videos, countries, durations, points = set(), set(), [], []
    env, time, source = collections.Counter(), collections.Counter(), collections.Counter()
    hours_by_country, hours_by_continent = collections.Counter(), collections.Counter()
    upload_months, continent_of = {}, {}
    env_time, continent_env, channel_hours = collections.Counter(), collections.Counter(), collections.Counter()
    for row in rows:
        starts, ends = parse_list(row['start_time']), parse_list(row['end_time'])
        environments, times = parse_list(row['walking_environment']), parse_list(row['time_of_day'])
        amounts = collections.Counter()
        row_seconds = 0
        for video_index, (video_starts, video_ends) in enumerate(zip(starts, ends)):
            video_env = environments[video_index] if video_index < len(environments) else []
            video_time = times[video_index] if video_index < len(times) else []
            for segment_index, (start, end) in enumerate(zip(video_starts, video_ends)):
                length = max(0.0, float(end) - float(start))
                segments += 1
                row_seconds += length
                durations.append(length / 60)
                segment_env = label(video_env[segment_index]) if segment_index < len(video_env) else 'Unknown'
                segment_time = WALK_TIME.get(str(video_time[segment_index]), 'Unknown') if segment_index < len(video_time) else 'Unknown'
                amounts[('Environment', segment_env)] += length / 3600
                amounts[('Time of day', segment_time)] += length / 3600
                env_time[(segment_env, segment_time)] += length / 3600
                if row['continent']:
                    continent_env[(row['continent'], segment_env)] += length / 3600
                video_channels = parse_list(row['channel'])
                if video_index < len(video_channels):
                    channel_hours[video_channels[video_index]] += length / 3600
        seconds += row_seconds
        row_videos = parse_list(row['videos'])
        videos.update(row_videos)
        for labels in environments:
            env.update(label(value) for value in labels)
        for labels in times:
            time.update(WALK_TIME.get(str(value), 'Unknown') for value in labels)
        for labels in parse_list(row['location_source']):
            source.update(WALK_SOURCE.get(value, label(value)) for value in labels)
        for video, stamp in zip(row_videos, parse_list(row['upload_date'])):
            stamp = str(stamp).zfill(8)
            if stamp.isdigit():
                upload_months[video] = f'{stamp[4:8]}-{stamp[2:4]}'
        if row['country']:
            name = country(row['country'])
            countries.add(name)
            hours_by_country[name] += row_seconds / 3600
            if row['continent']:
                hours_by_continent[row['continent']] += row_seconds / 3600
                continent_of[name] = row['continent']
        try:
            points.append([float(row['lat']), float(row['lon']), row_seconds / 3600, place(row), facet_counts(WALK_FACETS, amounts)])
        except ValueError:
            pass
    edges = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4.01]
    environments_shown = WALK_FACETS['Environment'] + ['Mixed']
    times_shown = WALK_FACETS['Time of day']
    places = merge_places(points)
    driving = crowd_hours_by_country()
    clips = {'Amsterdam', 'Bangkok', 'Barcelona', 'Hong Kong', 'Istanbul', 'Kyoto', 'Marrakesh', 'Mexico City',
             'Mumbai', 'New York', 'Paris', 'Rome', 'Seoul', 'Singapore', 'Tokyo', 'Venice'}
    def clip_for(name):
        city = name.split(',')[0].strip()
        return city.lower().replace(' ', '-') if city in clips else ''
    def continent_for(name):
        return continent_of.get(name.rsplit(',', 1)[-1].strip(), '')
    extra = {
        'env_by_time': {'rows': environments_shown, 'cols': times_shown,
                        'values': [[round(env_time[(e, t)], 1) for t in times_shown] for e in environments_shown]},
        'env_by_continent': {'rows': [c for c in CONTINENTS if hours_by_continent[c]], 'cols': environments_shown,
                             'values': [[round(continent_env[(c, e)], 1) for e in environments_shown]
                                        for c in CONTINENTS if hours_by_continent[c]]},
        'top_cities': [[p[3], p[2], continent_for(p[3]), clip_for(p[3])] for p in sorted(places, key=lambda p: -p[2])[:15]],
        'channel_curve': share_curve(list(channel_hours.values())),
        'channels': len(channel_hours),
        'walk_vs_drive': sorted([[name, round(hours, 1), driving[name], continent_of.get(name, '')]
                                 for name, hours in hours_by_country.items() if hours >= 1 and driving.get(name)],
                                key=lambda row: -row[1]),
    }
    return {
        **extra,
        'built': date.today().isoformat(),
        'stats': [
            ['Hours of walking', round(seconds / 3600)],
            ['Walking segments', segments],
            ['Source videos', len(videos)],
            ['Localities', sum(1 for row in rows if row['locality'])],  # not the one row of unplaced videos
            ['Countries and territories', len(countries)],
        ],
        'environment': ranked(env),
        'time_of_day': ranked(time),
        'location_source': ranked(source),
        'top_countries': [[name, value, continent_of.get(name, '')] for name, value in ranked(hours_by_country, 12)],
        'continents': ranked(hours_by_continent),
        'uploads': monthly(upload_months.values()),
        'duration': {'edges': edges, 'counts': histogram(durations, edges), 'unit': 'minutes'},
        'facets': WALK_FACETS,
        'continent_order': CONTINENTS,
        'compare_driving': True,
        'points': places,
        'point_unit': ['hour of walking', 'hours of walking'],
    }


def crash():
    rows = fetch_csv('car-crash-yt', 'crash_segments.csv')
    videos = {row['video_id'] for row in rows}
    seconds = sum(float(row['duration_seconds'] or 0) for row in rows)
    located = [row for row in rows if row['country']]
    fields = {}
    for field in ['event_kind', 'camera_view', 'time_of_day', 'weather', 'road_environment', 'road_condition']:
        fields[field] = ranked(collections.Counter(label(row[field]) for row in rows), 8)
    users = collections.Counter()
    for row in rows:
        users.update({label(value.strip(' "\'')) for value in row['road_users'].strip('[]').split(',') if value.strip(' "\'')})
    points = []
    for row in located:
        try:
            lat, lon = float(row['lat']), float(row['lon'])
        except ValueError:
            continue
        row_users = {label(value.strip(' "\'')) for value in row['road_users'].strip('[]').split(',')}
        amounts = {('Time of day', label(row['time_of_day'])): 1, ('Road', label(row['road_environment'])): 1,
                   ('Event', label(row['event_kind'])): 1, ('Crash type', label(row['crash_type'])): 1}
        amounts.update({('Road users', user): 1 for user in row_users})
        points.append([lat, lon, 1, place(row), facet_counts(CRASH_FACETS, amounts)])
    resolution = collections.Counter(
        'Place resolved' if row['country'] else
        'Evidence, place not found' if (row['location_evidence'] or 'none') != 'none' else 'No location evidence'
        for row in rows)
    evidence = collections.Counter({'none': 'No location evidence', 'embedded_text': 'Text in the video',
                                    'metadata': 'Title or description'}.get(row['location_evidence'] or 'none', 'Other')
                                   for row in rows)
    taxonomy = collections.Counter(label(row['crash_taxonomy_status']) for row in rows)
    sequence = collections.Counter()
    for row in rows:
        sequence.update(label(value.strip(' "\'')) for value in row['sequence_of_events'].strip('[]').split(',') if value.strip(' "\''))
    continent_of = {country(row['country']): row['continent'] for row in located if row['continent']}
    upload_months = {row['video_id']: row['upload_date'][:7] for row in rows if len(row['upload_date']) >= 7}
    durations = [float(row['duration_seconds'] or 0) for row in rows]
    edges = [0, 5, 10, 15, 20, 30, 45, 60, 120, math.inf]
    types = CRASH_FACETS['Crash type']
    groups = [('Weather', 'weather', ['Clear', 'Snow', 'Rain']),
              ('Light', 'time_of_day', ['Day', 'Night', 'Dawn or dusk']),
              ('Road', 'road_environment', ['Motorway', 'Urban', 'Rural', 'Junction', 'Parking', 'Intersection'])]
    by_type = collections.defaultdict(list)
    for row in rows:
        by_type[label(row['crash_type'])].append(row)
    conditions = {'rows': types, 'totals': [len(by_type[t]) for t in types], 'groups': [
        {'name': name, 'cols': cols,
         'values': [[sum(1 for row in by_type[t] if label(row[field]) == col) for col in cols] for t in types]}
        for name, field, cols in groups]}
    actual_types = [t for t in types if t != 'Near collision']
    continents_shown = [c for c in CONTINENTS if any(row['continent'] == c for row in located)]
    type_by_continent = {'rows': continents_shown, 'cols': actual_types, 'values': [
        [sum(1 for row in located if row['continent'] == c and label(row['crash_type']) == t) for t in actual_types]
        for c in continents_shown]}
    user_names = [name for name, _ in ranked(users, 8)]
    clip_users = [{label(value.strip(' "\'')) for value in row['road_users'].strip('[]').split(',')} for row in rows]
    cooccurrence = [[sum(1 for present in clip_users if a in present and b in present) for b in user_names] for a in user_names]
    clips_by_country = collections.defaultdict(list)
    for row in located:
        clips_by_country[country(row['country'])].append(row)
    night_share = sorted([[name, round(sum(1 for row in group if label(row['time_of_day']) == 'Night') / len(group) * 100, 1),
                           len(group), continent_of.get(name, '')]
                          for name, group in clips_by_country.items() if len(group) >= 100], key=lambda row: -row[1])
    extra = {
        'conditions': conditions,
        'type_by_continent': type_by_continent,
        'cooccurrence': {'names': user_names, 'values': cooccurrence},
        'length_by_type': [[t, quantiles([float(r['duration_seconds'] or 0) for r in by_type[t]]), len(by_type[t])]
                           for t in types if len(by_type[t]) >= 20],
        'night_share': night_share,
    }
    return {
        **extra,
        'built': date.today().isoformat(),
        'stats': [
            ['Crash and near-collision clips', len(rows)],
            ['Hours of footage', round(seconds / 3600)],
            ['Source videos', len(videos)],
            ['Clips with a verified place', len(located)],
            ['Countries and territories', len({country(row['country']) for row in located})],
        ],
        **fields,
        'road_users': ranked(users, 10),
        'top_countries': [[name, value, continent_of.get(name, '')] for name, value in
                          ranked(collections.Counter(country(row['country']) for row in located), 12)],
        'crash_type': ranked(collections.Counter(label(row['crash_type']) for row in rows)),
        'manner_of_collision': ranked(collections.Counter(label(row['manner_of_collision']) for row in rows if row['manner_of_collision'])),
        'first_harmful_event': ranked(collections.Counter(label(row['first_harmful_event']) for row in rows if row['first_harmful_event'])),
        'sequence_of_events': ranked(sequence),
        'continents': ranked(collections.Counter(row['continent'] for row in located if row['continent'])),
        'duration': {'edges': edges[:-1] + [None], 'counts': histogram(durations, edges[:-1] + [10**9]), 'unit': 'seconds'},
        'resolution': ranked(resolution),
        'evidence': ranked(evidence),
        'taxonomy': ranked(taxonomy),
        'uploads': monthly(upload_months.values()),
        'facets': CRASH_FACETS,
        'facet_neutral': {'Crash type': 'Near collision'},  # coloured by the actual crash type where there is one
        'continent_order': CONTINENTS,
        'points': merge_places(points),
        'point_unit': ['clip', 'clips'],
    }


JAY_LAW = {'ILLEGAL': 'Offence', 'REGULATED': 'Regulated duty', 'NOT ILLEGAL': 'Not an offence'}
JAY_ENFORCEMENT = {'No Specific Law': 'No specific law'}
JAY_FACETS = {
    'Law': ['Offence', 'Regulated duty', 'Not an offence', 'No rule set'],
    'Enforcement': ['Strict', 'Moderate', 'Lenient', 'No specific law', 'Not assessed', 'No rule set'],
    'Crossings without a marking': ['Above 2 an hour', '1 to 2 an hour', '0.5 to 1 an hour', 'Below 0.5 an hour', 'Not sampled'],
}
JAY_ISO = {'Bangladesh': 'BGD', 'Vietnam': 'VNM', 'France': 'FRA', 'Denmark': 'DNK', 'Sweden': 'SWE',
           'South Korea': 'KOR', 'China': 'CHN', 'Japan': 'JPN', 'India': 'IND'}
JAY_OUTCOMES = ['Without a marking', 'At a zebra crossing or light', 'Rejected by the VLM', 'Left uncertain']


def segment_seconds(row):
    """Seconds of footage per video of a CROWD mapping row (end minus start over its segments)."""
    starts, ends = parse_list(row['start_time']), parse_list(row['end_time'])
    return [sum(max(0, float(e) - float(s)) for s, e in zip(start, end)) for start, end in zip(starts, ends)]


def jaywalking():
    repo = 'crowd-jaywalking'
    rates = fetch_csv(repo, 'docs/jaywalking_rates.csv')
    counts = {row['country']: row for row in fetch_csv(repo, 'docs/crossings_by_country.csv')}
    four = {row['country']: row for row in fetch_csv(repo, 'docs/crossings_by_country_4bit.csv')}
    movement = fetch_csv(repo, 'docs/crossing_movement.csv')
    rules = json.loads(fetch_text(repo, 'configs/jaywalking_rules.json'))['countries']
    num = lambda value: float(value)
    rates.sort(key=lambda row: -num(row['jaywalking_per_hour']))
    rate_of = {JAY_ISO[row['country']]: num(row['jaywalking_per_hour']) for row in rates}

    # One dot per CROWD place, sized by its hours and coloured by its country's law.
    rows = [row for row in fetch_csv(repo, 'mapping.csv') if row['lat'] and row['iso3']]
    hours = collections.Counter()
    for row in rows:
        row['_hours'] = sum(segment_seconds(row)) / 3600
        hours[row['iso3']] += row['_hours']

    def bin_of(rate):
        if rate is None:
            return 'Not sampled'
        return 'Above 2 an hour' if rate > 2 else '1 to 2 an hour' if rate >= 1 else '0.5 to 1 an hour' if rate >= 0.5 else 'Below 0.5 an hour'

    points = []
    for row in rows:
        if row['_hours'] <= 0:
            continue
        rule = rules.get(row['iso3'])
        law = JAY_LAW[rule['legal_status']] if rule else 'No rule set'
        enforcement = JAY_ENFORCEMENT.get(rule['enforcement'], rule['enforcement']) if rule else 'No rule set'
        amounts = {('Law', law): row['_hours'], ('Enforcement', enforcement): row['_hours'],
                   ('Crossings without a marking', bin_of(rate_of.get(row['iso3']))): row['_hours']}
        points.append([float(row['lat']), float(row['lon']), row['_hours'], place(row), facet_counts(JAY_FACETS, amounts)])
    # Tenths of an hour are enough for dot sizes and keep the file small.
    points = [[lat, lon, round(value, 1), name, [[round(v, 1) for v in values] for values in facets]]
              for lat, lon, value, name, facets in merge_places(points)]
    covered = sum(amount for iso, amount in hours.items() if iso in rules)

    law_name = lambda name: country(name.replace('Viet Nam', 'Vietnam').replace('United States of America', 'United States'))
    law_rows = []
    for iso, rule in sorted(rules.items(), key=lambda item: country(item[1]['name'])):
        conditions = len(rule.get('required', [])) + len(rule.get('triggers', [])) + len(rule.get('supplementary', []) or [])
        law_rows.append([law_name(rule['name']),
                         JAY_LAW[rule['legal_status']], JAY_ENFORCEMENT.get(rule['enforcement'], rule['enforcement']),
                         conditions, rule['fines'], round(hours.get(iso, 0))])

    detected = sum(int(row['crossings_detected']) for row in counts.values())
    without = sum(int(row['crossings_without_zebra_or_light']) for row in counts.values())
    sample_hours = sum(num(row['hours']) for row in counts.values())
    law_counts = collections.Counter(row[1] for row in law_rows)
    enforcement_counts = collections.Counter(row[2] for row in law_rows)

    def moves(value, low, high):
        """Per compared country (most people without a marking first): without a marking, its 95%
        interval, at a marking, its interval, and the number of people in each group."""
        groups = collections.defaultdict(dict)
        for row in movement:
            if row['compared'] == 'True':
                groups[row['country']][row['group']] = row
        out = []
        for name, group in sorted(groups.items(), key=lambda item: -int(item[1]['without_marking']['people'])):
            w, a = group['without_marking'], group['at_marking']
            out.append([name, *[round(num(r[key]), 3) for r in (w, a) for key in (value, low, high)],
                        int(w['people']), int(a['people'])])
        return out

    return {
        'stats': [
            ['Countries sampled', len(counts)],
            ['Hours of footage analysed', round(sample_hours)],
            ['Crossings detected', detected],
            ['Crossings without a marking', without],
            ['Countries with a law rule set', len(rules)],
        ],
        'rates': [[row['country'], num(row['jaywalking_per_hour']), num(row['per_hour_low']), num(row['per_hour_high'])] for row in rates],
        'shares': sorted([[row['country'], num(row['share_without_pct']), num(row['share_low_pct']), num(row['share_high_pct'])] for row in rates], key=lambda row: -row[1]),
        'outcomes': {
            'rows': [row['country'] for row in rates],
            'cols': JAY_OUTCOMES,
            'values': [[int(row['crossings_without_zebra_or_light']), int(row['at_zebra_or_light']), int(row['rejected_by_vlm']), int(row['uncertain'])] for row in rates],
        },
        'per_hour_detected': sorted([[name, round(int(row['crossings_detected']) / num(row['hours']), 1)] for name, row in counts.items()], key=lambda row: -row[1]),
        'bit_depth': {
            'labels': ['VLM at 4 bits', 'VLM at 16 bits'],
            'unit': '',
            'rows': [[name, num(four[name]['jaywalking_per_hour']), num(counts[name]['jaywalking_per_hour'])]
                     for name in sorted(four, key=lambda name: -num(counts[name]['jaywalking_per_hour']))],
        },
        'with_others': {'labels': ['Without a marking', 'At a marking'], 'unit': '%', 'rows': moves('with_others_pct', 'with_others_low_pct', 'with_others_high_pct')},
        'vehicles': {'labels': ['Without a marking', 'At a marking'], 'unit': '', 'rows': moves('vehicles_mean', 'vehicles_low', 'vehicles_high')},
        'speed': {'labels': ['Without a marking', 'At a marking'], 'unit': '', 'rows': moves('lateral_speed_mean', 'lateral_speed_low', 'lateral_speed_high')},
        'stopped': {'labels': ['Without a marking', 'At a marking'], 'unit': '%', 'rows': moves('stopped_pct', 'stopped_low_pct', 'stopped_high_pct')},
        'funnel': [['JAAD crossers with no zebra crossing and no light', 111], ['Proposed by stage 1', 40],
                   ['Confirmed by the VLM crossing check', 29], ['Claimed after the infrastructure check', 22]],
        'jaad_splits': [['Train', 165, 13, 13, 13, 65], ['Test', 117, 8, 8, 7, 39], ['Val', 27, 2, 2, 2, 7]],
        'law_status': [[name, law_counts[name]] for name in JAY_FACETS['Law'][:3]],
        'law_enforcement': [[name, enforcement_counts[name]] for name in JAY_FACETS['Enforcement'][:5] if enforcement_counts[name]],
        'law_table': law_rows,
        'law_hours_share': round(100 * covered / sum(hours.values()), 1),
        # Every rule set in full, for the explorer: conditions are [id, kind, text].
        'law_rules': {
            law_name(rule['name']): {
                'law': JAY_LAW[rule['legal_status']],
                'enforcement': JAY_ENFORCEMENT.get(rule['enforcement'], rule['enforcement']),
                'basis': rule.get('legal_basis', ''),
                'source': rule.get('source', ''),
                'details': rule.get('details', ''),
                'fines': rule.get('fines', ''),
                'decision': rule.get('decision_text', ''),
                'by_hand': bool(rule.get('added_by_hand')),
                'conditions': [[c['id'], kind, c['text']]
                               for key, kind in (('required', 'Required'), ('triggers', 'Trigger'), ('supplementary', 'Added by hand'))
                               for c in (rule.get(key) or [])],
            } for rule in rules.values()
        },
        'flow': [
            ['Proposed by the detector', detected],
            ['Rejected by the VLM: not a crossing', sum(int(row['rejected_by_vlm']) for row in counts.values())],
            ['At a zebra crossing or light', sum(int(row['at_zebra_or_light']) for row in counts.values())],
            ['Without a marking', without],
            ['Left uncertain', sum(int(row['uncertain']) for row in rates)],
        ],
        'facets': JAY_FACETS,
        'chart_facets': {'Outcome': JAY_OUTCOMES},
        'facet_neutral': {'Law': 'No rule set', 'Enforcement': 'No rule set', 'Crossings without a marking': 'Not sampled',
                          'Outcome': 'Rejected by the VLM'},
        'continent_order': CONTINENTS,
        'points': points,
        'point_unit': ['hour of CROWD footage', 'hours of CROWD footage'],
    }


TC_GROUPS = {'A': 'Road users', 'B': 'Vehicles', 'C': 'Traffic signs', 'D': 'Traffic signals', 'E': 'Road markings',
             'F': 'Road infrastructure', 'G': 'Temporary objects', 'H': 'Animals', 'I': 'Country-specific'}
TC_VEHICLES = {'0': 'Car', '1': 'Bus', '2': 'Truck', '3': 'Two-wheeler', '4': 'Bicycle'}
TC_FACETS = {
    'Continent': CONTINENTS,
    'Time of day': ['Day', 'Night'],
    'Camera on': ['Car', 'Bus', 'Truck', 'Two-wheeler', 'Bicycle', 'Other'],
}

# Box-by-box checks by eye, from the README of TraffCOCO branch pipeline-fixes-surfaces-sign-text
# (2026-11-19, not yet on main). Shadab asked for them on the page on 2026-11-20; read them from
# the README once the branch is merged.
TC_QUALITY = {
    'quality_pilot': {
        'rows': ['Tokyo, Japan', 'Toyokawa, Japan', 'Bengaluru, India', 'Amsterdam, Netherlands',
                 'Eindhoven, Netherlands', 'Tilburg, Netherlands'],
        'cols': ['Correct', 'Wrong', 'Undecidable'],
        'values': [[7, 1, 3], [10, 1, 0], [18, 2, 6], [5, 2, 2], [16, 3, 6], [4, 0, 0]],
    },
    'quality_groups': [['Road users', 94], ['Vehicles', 81], ['Road infrastructure', 76],
                       ['Traffic lights', 51], ['Traffic signs', 43], ['Road markings', 29]],
    'quality_continents': [['Asia', 80], ['Africa', 73], ['Europe', 69], ['South America', 67],
                           ['North America', 54], ['Oceania', 53], ['Night', 75], ['Day', 69]],
    'quality_fixes': {
        'labels': ['Before the fix', 'After'],
        'unit': '%',
        'rows': [['Lamp question per light, mask duplicate check', 53, 84],
                 ['Class question for every vehicle and person', 56, 76],
                 ['Sign choices in the conflict check, name filter', 60, 71]],
    },
}


def traffcoco():
    repo = 'TraffCOCO'
    ontology = json.loads(fetch_text(repo, 'annotation_pipeline/models/ontology/traffic_ontology_v2.json'))
    points, videos, places, countries = [], set(), 0, set()
    for row in fetch_csv(repo, 'mapping.csv'):
        if not row['lat']:
            continue
        ids = parse_list(row['videos'])
        tod = parse_list(row['time_of_day'])
        vehicles = parse_list(row['vehicle_type'])
        per_video = segment_seconds(row)
        amounts = collections.Counter()
        for index, seconds in enumerate(per_video):
            if not seconds:
                continue
            times = tod[index] if index < len(tod) and isinstance(tod[index], list) else []
            night = sum(1 for t in times if str(t) == '1') / len(times) if times else 0
            amounts[('Time of day', 'Night')] += seconds * night
            amounts[('Time of day', 'Day')] += seconds * (1 - night)
            vehicle = TC_VEHICLES.get(str(vehicles[index]) if index < len(vehicles) else '', 'Other')
            amounts[('Camera on', vehicle)] += seconds
            amounts[('Continent', row['continent'])] += seconds
        total = sum(per_video)
        if total <= 0:
            continue
        videos.update(ids)
        places += 1
        countries.add(row['country'])
        hours = {key: value / 3600 for key, value in amounts.items()}
        points.append([float(row['lat']), float(row['lon']), total / 3600, place(row), facet_counts(TC_FACETS, hours)])
    points = [[lat, lon, round(value, 1), name, [[round(v, 1) for v in values] for values in facets]]
              for lat, lon, value, name, facets in merge_places(points)]

    classes = ontology['classes']
    group_of = lambda item: TC_GROUPS.get(item['class_id'][:1], 'Other')
    groups = collections.Counter(group_of(item) for item in classes)
    regional = collections.Counter()
    for item in classes:
        for name in str(item.get('country') or 'Global').split(','):
            name = {'UK': 'United Kingdom', 'USA': 'United States'}.get(name.strip(), name.strip())
            if name and name != 'Global':
                regional[name] += 1
    return {
        'stats': [
            ['Countries', len(countries)],
            ['Videos', len(videos)],
            ['Localities', places],
            ['Frames planned', 17_000_000],  # the README's ~17 M (15 to 18 M at one frame every 20 s)
            ['Object classes', len(classes)],
            ['Surface classes', 26],
        ],
        'class_groups': [[name, groups[name]] for name in TC_GROUPS.values() if groups[name]],
        'class_regions': [[name, count] for name, count in regional.most_common(14)],
        'classes': [[item['class_id'], item['class_name'], group_of(item), item.get('country') or 'Global',
                     item.get('description', ''), item.get('grounding_prompt') or '']
                    for item in classes],
        'chart_facets': {'Class group': list(TC_GROUPS.values()), 'Verdict': ['Correct', 'Wrong', 'Undecidable']},
        'facet_neutral': {'Verdict': 'Undecidable'},
        **TC_QUALITY,
        'facets': TC_FACETS,
        'continent_order': CONTINENTS,
        'points': points,
        'point_unit': ['hour of footage', 'hours of footage'],
    }


def plotly_traces(text):
    """The traces and layout of a Plotly HTML figure, with typed arrays (bdata) decoded."""
    import base64
    import re
    import struct
    codes = {'f8': 'd', 'f4': 'f', 'i4': 'i', 'i2': 'h', 'i1': 'b', 'u1': 'B', 'u2': 'H', 'u4': 'I'}

    def decode(value):
        if isinstance(value, dict) and 'bdata' in value:
            raw = base64.b64decode(value['bdata'])
            code = codes[value['dtype']]
            values = list(struct.unpack('<%d%s' % (len(raw) // struct.calcsize(code), code), raw))
            shape = str(value.get('shape', ''))
            if ',' in shape:
                _, cols = [int(part) for part in shape.split(',')]
                values = [values[i:i + cols] for i in range(0, len(values), cols)]
            return values
        if isinstance(value, dict):
            return {key: decode(item) for key, item in value.items()}
        if isinstance(value, list):
            return [decode(item) for item in value]
        return value

    start = list(re.finditer(r'Plotly\.newPlot\(\s*"[0-9a-f-]+",\s*', text))[-1].end()
    data, end = json.JSONDecoder().raw_decode(text[start:])
    layout, _ = json.JSONDecoder().raw_decode(text[start + end:].lstrip(', \n'))
    return decode(data), layout


CITY_FACETS = {
    'Crossing speed': ['Above 1.45 m/s', '1.35 to 1.45 m/s', '1.25 to 1.35 m/s', 'Below 1.25 m/s', 'Not measured'],
    'Initiation time': ['Under 1.5 s', '1.5 to 2.5 s', '2.5 to 4 s', '4 s or more', 'Not measured'],
    'Continent': CONTINENTS,
}


def city():
    """Results of github.com/crowd-dataset/crowd-city, read from the interactive figures on its main branch."""
    repo = 'crowd-city'
    figure = lambda name: plotly_traces(fetch_text(repo, f'figures/{name}.html'))
    number = lambda value: value if isinstance(value, (int, float)) and not (isinstance(value, float) and math.isnan(value)) else None

    # The map's points carry each city's full row of results.
    traces, _ = figure('mapbox_map')
    names = {}
    for match in __import__('re').finditer(r'([A-Za-z0-9_ ]+)=%\{customdata\[(\d+)\]\}', traces[0]['hovertemplate']):
        names[int(match.group(2))] = match.group(1).strip()
    columns = [names.get(i, f'c{i}') for i in range(max(names) + 1)]
    rows = [dict(zip(columns, values)) for trace in traces for values in trace['customdata']]
    for row in rows:
        row['name'] = country(row['locality'].replace('København', 'Copenhagen'))
        row['label'] = f"{row['name']}, {country(row['country'])}"
        row['speed'] = number(row['speed_crossing_day_night_locality_avg'])
        row['wait'] = number(row['time_crossing_day_night_locality_avg'])

    def speed_bin(value):
        if value is None:
            return 'Not measured'
        return 'Above 1.45 m/s' if value > 1.45 else '1.35 to 1.45 m/s' if value >= 1.35 else '1.25 to 1.35 m/s' if value >= 1.25 else 'Below 1.25 m/s'

    def wait_bin(value):
        if value is None:
            return 'Not measured'
        return 'Under 1.5 s' if value < 1.5 else '1.5 to 2.5 s' if value < 2.5 else '2.5 to 4 s' if value < 4 else '4 s or more'

    points = []
    for row in rows:
        amount = number(row['crossing_detected_locality']) or 0
        if not amount:
            continue
        amounts = {('Crossing speed', speed_bin(row['speed'])): amount, ('Initiation time', wait_bin(row['wait'])): amount,
                   ('Continent', row['continent']): amount}
        points.append([round(row['lat'], 2), round(row['lon'], 2), amount, row['label'], facet_counts(CITY_FACETS, amounts)])

    measured = [row for row in rows if row['speed'] is not None]
    by_speed = sorted(measured, key=lambda row: -row['speed'])
    timed = sorted([row for row in rows if row['wait'] is not None], key=lambda row: -row['wait'])
    both = [row for row in rows if number(row['speed_crossing_day_locality']) and number(row['speed_crossing_night_locality'])]
    both.sort(key=lambda row: -abs(row['speed_crossing_night_locality'] - row['speed_crossing_day_locality']))
    lights = []
    for row in rows:
        with_light = sum(number(row[k]) or 0 for k in ('with_trf_light_day_locality', 'with_trf_light_night_locality'))
        without = sum(number(row[k]) or 0 for k in ('without_trf_light_day_locality', 'without_trf_light_night_locality'))
        if with_light + without >= 30:
            lights.append([row['label'], round(100 * without / (with_light + without), 1), row['continent']])
    lights.sort(key=lambda item: -item[1])

    speeds = figure('hist_speed')[0][0]['x']
    waits = figure('hist_time')[0][0]['x']

    def histogram_of(values, edges):
        counts = [0] * (len(edges) - 1)
        for value in values:
            for i in range(len(counts)):
                if edges[i] <= value < edges[i + 1] or (i == len(counts) - 1 and value >= edges[i]):
                    counts[i] += 1
                    break
        return counts

    speed_edges = [round(0.8 + 0.1 * i, 1) for i in range(12)] + [None]
    wait_edges = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, None]
    boxes = []
    for continent in CONTINENTS:
        values = sorted(row['speed'] for row in measured if row['continent'] == continent)
        if len(values) >= 3:
            at = lambda q: values[min(len(values) - 1, max(0, round(q * (len(values) - 1))))]
            boxes.append([continent, [round(at(q), 3) for q in (0.05, 0.25, 0.5, 0.75, 0.95)], len(values)])

    corr, _ = figure('correlation_matrix_heatmap_averaged')
    labels, matrix = corr[0]['x'], corr[0]['z']
    pretty = {'gmp': 'Gross metropolitan product', 'traffic_mortality': 'Traffic mortality', 'literacy_rate': 'Literacy rate',
              'Gini coefficient': 'Income inequality (Gini)', 'Crossing': 'Crossings', 'Crossings without traffic light': 'Crossings without a light',
              'Traffic Index': 'Traffic congestion index'}
    def correlations(target):
        at = labels.index(target)
        out = [[pretty.get(label, label), round(matrix[at][i], 2)] for i, label in enumerate(labels)
               if i != at and label not in ('Crossing speed (m/s)', 'Crossing initiation time') and matrix[at][i] is not None]
        return sorted(out, key=lambda item: -abs(item[1]))[:10]

    waymo, layout = figure('waymo_validation_speed_error')
    title = layout['title']['text'] if isinstance(layout.get('title'), dict) else ''
    stats = {key: float(value) for key, value in __import__('re').findall(r'(MAE|RMSE|bias) (-?[0-9.]+)', title)}
    selection, _ = figure('waymo_speed_selection_summary')
    reliability, _ = figure('structure_reliability')

    return {
        'stats': [
            ['Cities', len(rows)],
            ['Countries', len({row['iso3'] for row in rows})],
            ['Hours analysed', round(sum(number(row['total_time']) or 0 for row in rows) / 3600)],
            ['Road crossings analysed', int(sum(number(row['crossing_detected_locality']) or 0 for row in rows))],
            ['Crossing speeds measured', len(speeds)],
        ],
        'fastest': [[row['label'], round(row['speed'], 2), row['continent']] for row in by_speed[:12]],
        'slowest': [[row['label'], round(row['speed'], 2), row['continent']] for row in by_speed[::-1][:12]],
        'longest_wait': [[row['label'], round(row['wait'], 2), row['continent']] for row in timed[:12]],
        'shortest_wait': [[row['label'], round(row['wait'], 2), row['continent']] for row in timed[::-1][:12]],
        'mean_speed': round(sum(row['speed'] for row in measured) / len(measured), 2),
        'extremes': {'fast': [by_speed[0]['label'], round(by_speed[0]['speed'], 2)],
                     'slow': [by_speed[-1]['label'], round(by_speed[-1]['speed'], 2)]},
        'day_night': {'labels': ['Day', 'Night'], 'unit': ' m/s',
                      'rows': [[row['label'], round(row['speed_crossing_day_locality'], 2), round(row['speed_crossing_night_locality'], 2)] for row in both[:14]]},
        'speed_hist': {'edges': speed_edges, 'counts': histogram_of(speeds, [e for e in speed_edges if e is not None] + [99]), 'unit': 'm/s'},
        'wait_hist': {'edges': wait_edges, 'counts': histogram_of(waits, [e for e in wait_edges if e is not None] + [999]), 'unit': 'seconds'},
        'speed_boxes': boxes,
        'no_light': lights[:14],
        'corr_speed': correlations('Crossing speed (m/s)'),
        'corr_wait': correlations('Crossing initiation time'),
        'waymo_points': [[round(x, 3), round(y, 3)] for x, y in zip(waymo[0]['x'], waymo[0]['y'])],
        'waymo_stats': stats,
        'waymo_selection': [[trace['name'], trace['y'][0], trace['y'][1]] for trace in selection],
        'reliability': [[trace['name'], [[x, round(y, 2)] for x, y in zip(trace['x'], trace['y'])]] for trace in reliability],
        'counts': {'speeds': len(speeds), 'waits': len(waits)},
        'facets': CITY_FACETS,
        'facet_neutral': {'Crossing speed': 'Not measured', 'Initiation time': 'Not measured'},
        'continent_order': CONTINENTS,
        'points': points,
        'point_unit': ['road crossing', 'road crossings'],
    }


if __name__ == '__main__':
    pages = [('walking', walking), ('crash', crash), ('jaywalking', jaywalking), ('traffcoco', traffcoco), ('city', city)]
    chosen = sys.argv[1:]
    for name, build in pages:
        if chosen and name not in chosen:
            continue
        data = build()
        with open(f'data/{name}.json', 'w', encoding='utf-8') as handle:
            json.dump(data, handle, ensure_ascii=False, separators=(',', ':'))
        print(name, dict(data['stats']), len(data['points']), 'points')
