"""Summaries for the CROWD Walking and CROWD Crash pages.

Reads the outputs of github.com/crowd-dataset/walking-yt (mapping.csv) and
github.com/crowd-dataset/car-crash-yt (crash_segments.csv, mapping.csv) and writes
data/walking.json and data/crash.json, which walking/ and crash/ draw from.
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
            ['Localities', len(rows)],
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


if __name__ == '__main__':
    for name, build in [('walking', walking), ('crash', crash)]:
        data = build()
        with open(f'data/{name}.json', 'w', encoding='utf-8') as handle:
            json.dump(data, handle, ensure_ascii=False, separators=(',', ':'))
        print(name, dict(data['stats']), len(data['points']), 'points')
