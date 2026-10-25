// The README figures of github.com/crowd-dataset/crowd, told as a story in chapters.
// Each row lists its blocks; a block's ratio (width / height) sets its share of the row, so every
// block in a row has the same height. Variants of one chart share a frame with tabs.
// Figures the README adds later and this file does not know land in a last "More figures" chapter.

const FIGURE_STORY = [
  {
    id: 'where',
    short: 'Where',
    title: 'Where the footage is',
    intro: 'Every dot is a city or town with driving footage. Coverage is densest in North America, Europe and East Asia, and reaches into every continent, down to individual counties and regions.',
    rows: [
      [{ title: 'The world map', ratio: 1.75, tabs: [
        ['By continent', 'mapbox_map_all'],
        ['Hours of footage', 'mapbox_map_all_time'],
        ['Number of videos', 'mapbox_map_all_videos'],
        ['Population', 'mapbox_map_all_pop'],
        ['Sized by hours', 'map_localities_footage'],
      ] }],
      [
        { title: 'On a globe', ratio: 1.2, tabs: [
          ['Localities', 'globe_localities_footage'],
          ['Day and night spikes', 'globe_localities_footage_spikes'],
          ['Dashboard globe', 'globe_localities_widget'],
        ] },
        { title: 'Footage by continent, country and city', ratio: 1.78, figure: 'treemap_footage' },
      ],
      [{ title: 'Zoom in', ratio: 1.78, groups: [
        ['Continents', [
          ['Africa', 'map_footage_africa'], ['Asia', 'map_footage_asia'], ['Europe', 'map_footage_europe'],
          ['North America', 'map_footage_north_america'], ['Oceania', 'map_footage_oceania'], ['South America', 'map_footage_south_america'],
        ]],
        ['United States', [
          ['States', 'map_us_states_footage'], ['Counties', 'map_us_counties_footage'],
          ['Per person', 'map_us_counties_footage_per_capita'], ['Night share', 'map_us_counties_night_share'], ['As spikes', 'spikes_footage_usa'],
        ]],
        ['European regions', [
          ['Hours', 'map_eu_regions_footage'], ['Per person', 'map_eu_regions_footage_per_capita'], ['Night share', 'map_eu_regions_night_share'],
        ]],
        ['Russia and Japan', [['Russia', 'spikes_footage_rus'], ['Japan', 'spikes_footage_jpn']]],
      ] }],
      [
        { title: 'How dense the footage is', ratio: 1.17, tabs: [
          ['Europe', 'map_density_footage_europe'], ['North America', 'map_density_footage_north_america'], ['Asia', 'map_density_footage_asia'],
        ] },
        { title: 'How far to the nearest footage', ratio: 1.17, tabs: [
          ['Europe', 'map_distance_to_footage_europe'], ['North America', 'map_distance_to_footage_north_america'], ['Asia', 'map_distance_to_footage_asia'],
        ] },
      ],
    ],
  },
  {
    id: 'filmed',
    short: 'Filming',
    title: 'How it was filmed',
    intro: 'When the videos were uploaded, how much of the driving happens at night, what the camera is mounted on, and how long a continuous segment runs.',
    rows: [
      [
        { title: 'Uploads over time', ratio: 1.78, figure: 'hist_months' },
        { title: 'Average upload year across Europe', ratio: 1.17, figure: 'map_upload_year_europe' },
      ],
      [
        { title: 'Day and night by continent', ratio: 1.78, figure: 'bar_continent_time_of_day' },
        { title: 'Share of footage at night', ratio: 1.78, tabs: [
          ['World', 'map_night_share'], ['Europe', 'map_night_share_europe'], ['Europe, smoothed', 'map_night_share_smoothed_europe'],
        ] },
      ],
      [
        { title: 'What the camera rides on', ratio: 1.78, figure: 'bar_vehicle_type_time_of_day' },
        { title: 'Vehicle types by continent', ratio: 1.78, figure: 'bar_vehicle_type_continent' },
      ],
      [
        { title: 'How long segments are', ratio: 1.78, figure: 'hist_segment_length' },
        { title: 'Segment length by continent and vehicle', ratio: 1.78, figure: 'box_segment_length' },
      ],
    ],
  },
  {
    id: 'fair',
    short: 'Representation',
    title: 'Is the world fairly represented?',
    intro: 'Footage follows people, money and YouTube culture: some countries and cities have far more footage than their population or wealth would predict, others far less.',
    rows: [
      [
        { text: true, ratio: 0.85, kicker: 'Representation', heading: 'Footage share against population share',
          body: 'For each of the most populous countries, the orange dot is its share of CROWD footage and the blue dot its share of the world population. A long line means a country is strongly over- or under-represented.' },
        { title: 'Share of footage against share of population', ratio: 1.68, figure: 'dumbbell_footage_population_share' },
      ],
      [
        { title: 'Footage per person', ratio: 1.78, tabs: [
          ['World', 'map_footage_per_capita'], ['Europe', 'map_footage_per_capita_europe'], ['Against wealth', 'bubble_footage_per_capita_gdp'],
        ] },
        { title: 'Footage and city size', ratio: 1.78, tabs: [
          ['Per locality', 'scatter_population_footage'], ['Against the trend', 'scatter_locality_footage_vs_population'], ['By size band', 'bar_footage_population_band'],
        ] },
      ],
      [
        { title: 'Footage against city economy', ratio: 1.78, figure: 'scatter_gmp_footage' },
        { title: 'Footage against traffic congestion', ratio: 1.78, figure: 'scatter_traffic_index_footage' },
      ],
      [
        { title: 'Footage against country indicators', ratio: 1.78, figure: 'scatter_indicators_footage' },
        { title: 'Videos against hours', ratio: 1.78, tabs: [
          ['Localities, log', 'scatter_all_total_time-video_count'], ['Localities, linear', 'scatter_all_total_time-video_count_linear'],
          ['Countries, log', 'scatter_all_country_total_time-video_count'], ['Countries, linear', 'scatter_all_country_total_time-video_count_linear'],
        ] },
      ],
    ],
  },
  {
    id: 'channels',
    short: 'Channels',
    title: 'Who films it',
    intro: 'The footage comes from thousands of YouTube channels, but a few large ones film much of it, and in some countries a single channel supplies most of the footage.',
    rows: [
      [
        { title: 'Share of footage from the largest channels', ratio: 1.78, figure: 'line_channel_concentration' },
        { title: 'Share from each country\'s largest channel', ratio: 1.78, figure: 'map_top_channel_share' },
      ],
      [
        { title: 'Effective number of channels', ratio: 1.78, figure: 'map_effective_channels' },
        { title: 'Channels against footage', ratio: 1.78, figure: 'bubble_channels_vs_footage' },
      ],
      [
        { text: true, ratio: 0.8, kicker: 'Small multiples', heading: 'Where the 20 biggest channels film',
          body: 'Each small map is one of the 20 channels with the most footage. Most film in one city or country; a few travel across continents.' },
        { title: 'Footprints of the 20 largest channels', ratio: 1.43, figure: 'map_channel_footprints' },
      ],
    ],
  },
  {
    id: 'road-users',
    short: 'Road users',
    title: 'What the cameras see',
    intro: 'YOLO11x detects and tracks persons, cars, bicycles, motorcycles, buses and trucks in the footage. The mix of road users changes strongly from one city and country to the next.',
    rows: [
      [
        { title: 'Road-user mix of 30 localities', ratio: 0.72, figure: 'waffle_road_user_mix' },
        { title: 'Road users per minute, 40 countries', ratio: 1.48, figure: 'heatmap_road_users_per_minute' },
      ],
      [
        { title: 'Road-user mix by continent', ratio: 1.78, figure: 'bar_road_user_mix_continent' },
        { title: 'Road-user mix by country', ratio: 1.78, figure: 'bar_road_user_mix' },
      ],
      [
        { title: 'Day against night', ratio: 1.78, figure: 'bar_road_users_day_night' },
        { title: 'Two-wheelers', ratio: 1.78, tabs: [
          ['World', 'map_two_wheeler_share'], ['Europe, motorcycles', 'map_motorcycle_share_europe'], ['Against wealth', 'bubble_motorcycles_gdp'],
        ] },
      ],
    ],
  },
  {
    id: 'pedestrians',
    short: 'Pedestrians',
    title: 'Pedestrians around the world',
    intro: 'Pedestrians per minute of driving is a simple measure of how busy the pavements are. It varies by more than ten times between countries, and also between day and night.',
    rows: [
      [{ title: 'Pedestrians per minute', ratio: 1.78, tabs: [
        ['World', 'map_pedestrians_per_minute'], ['Europe', 'map_pedestrians_per_minute_europe'],
        ['European regions', 'map_eu_regions_pedestrians'], ['Europe, smoothed', 'map_pedestrians_smoothed_europe'], ['US counties', 'map_us_counties_pedestrians'],
      ] }],
      [
        { title: 'Every country, with its uncertainty', ratio: 0.71, figure: 'dot_pedestrians_per_minute' },
        { title: 'Day against night, per country', ratio: 0.71, figure: 'dumbbell_pedestrians_day_night' },
        { ratio: 1.05, stack: [
          { title: 'Per locality, by continent', ratio: 1.78, figure: 'box_pedestrians_per_minute_continent' },
          { title: 'Across all segments', ratio: 1.78, figure: 'hist_pedestrians_per_minute_segment' },
        ] },
      ],
      [
        { text: true, ratio: 0.8, kicker: 'City size', heading: 'Do bigger cities have busier streets?',
          body: 'Pedestrians per minute set against the population of each locality: by size band per continent, for every locality, and against what its size predicts.' },
        { title: 'Pedestrians and city size', ratio: 1.78, tabs: [
          ['By size band', 'bar_pedestrians_city_size'], ['Per locality', 'scatter_pedestrians_population'], ['Against the trend', 'scatter_locality_pedestrians_vs_population'],
        ] },
      ],
    ],
  },
  {
    id: 'streets',
    short: 'Streets',
    title: 'Walkable, wealthy and safe streets',
    intro: 'Putting pedestrians, cars and bicycles next to wealth, cycling culture and road deaths: where streets are walkable, and where walking is more dangerous than the number of pedestrians suggests.',
    rows: [
      [
        { title: 'Walkable, busy, car-dominated or quiet', ratio: 1.78, figure: 'scatter_walkable_car_dominated' },
        { title: 'Walkable street minutes in Europe', ratio: 1.4, tabs: [
          ['Smoothed', 'map_walkable_minutes_europe'], ['Per country', 'map_walkable_minutes_countries_europe'],
        ] },
      ],
      [
        { title: 'Cycling', ratio: 1.78, tabs: [
          ['European regions', 'map_eu_regions_bicycles'], ['Europe, smoothed', 'map_bicycles_smoothed_europe'], ['Against wealth', 'bubble_bicycles_gdp'],
        ] },
        { title: 'Street life against wealth', ratio: 1.78, tabs: [
          ['Pedestrians', 'bubble_pedestrians_gdp'], ['Cars', 'bubble_cars_gdp'],
        ] },
      ],
      [
        { title: 'Road deaths against pedestrians', ratio: 1.78, figure: 'bubble_road_deaths_vs_pedestrians' },
        { title: 'Pedestrian deaths against pedestrians', ratio: 1.78, figure: 'bubble_pedestrian_deaths_vs_pedestrians' },
      ],
      [
        { text: true, ratio: 0.8, kicker: '16 indicators', heading: 'What goes with busy pavements?',
          body: 'Pedestrians per minute in each country against population, road deaths, inequality, age, literacy, wealth, urbanisation, vehicles, health, climate, farming and congestion.' },
        { title: 'Pedestrians against country indicators', ratio: 1.33, figure: 'scatter_indicators_pedestrians' },
      ],
    ],
  },
  {
    id: 'caveats',
    short: 'Caveats',
    title: 'Reading the detections with care',
    intro: 'The detections are automatic, not hand-checked. Coverage, the camera\'s viewpoint and newer cameras all change what the detector sees, so read comparisons with these effects in mind.',
    rows: [
      [
        { title: 'How much footage has been analysed', ratio: 1.78, figure: 'map_detection_coverage' },
        { title: 'How many hours a stable estimate needs', ratio: 1.78, figure: 'scatter_interval_width_hours' },
      ],
      [
        { title: 'Pedestrians by camera vehicle', ratio: 1.78, figure: 'bar_pedestrians_vehicle_type' },
        { title: 'Detections by upload year', ratio: 1.78, figure: 'line_road_users_upload_year' },
      ],
    ],
  },
];

// Left out of the story: who added how much footage is acknowledged in words, not charted.
const FIGURES_LEFT_OUT = ['area_contributors_footage'];

const story = {
  byName: new Map(),
  ordered: [],
};

function storyFigure(name) {
  return story.byName.get(name);
}

function blockFigures(block) {
  if (block.figure) return [block.figure];
  if (block.tabs) return block.tabs.map(([, name]) => name);
  if (block.groups) return block.groups.flatMap(([, tabs]) => tabs.map(([, name]) => name));
  if (block.stack) return block.stack.flatMap(blockFigures);
  return [];
}

function openStoryFigure(name) {
  overview.visibleFigures = story.ordered;
  openFigure(story.ordered.findIndex((figure) => figure.name === name));
}

function renderFigureFrame(container, block, name) {
  const figure = storyFigure(name);
  const frame = el('button', { type: 'button', className: 'story-frame', style: `aspect-ratio: ${block.ratio}`, 'aria-label': `Enlarge: ${figure.title}` },
    el('img', { src: figure.image, alt: figure.title, loading: 'lazy', decoding: 'async' }));
  frame.addEventListener('click', () => openStoryFigure(name));

  const caption = el('div', { className: 'story-caption' });
  appendInlineMarkdown(caption, figure.caption);
  const actions = el('div', { className: 'story-actions' }, [
    el('a', { href: figure.interactiveUrl, target: '_blank', rel: 'noreferrer noopener', text: 'Interactive' }),
  ]);
  const enlarge = el('button', { type: 'button', text: 'Enlarge' });
  enlarge.addEventListener('click', () => openStoryFigure(name));
  actions.prepend(enlarge);

  container.replaceChildren(frame, el('div', { className: 'story-meta' }, [caption, actions]));
}

function renderTabs(tabs, onSelect, className = 'story-tabs') {
  const list = el('div', { className, role: 'tablist' });
  tabs.forEach(([label], index) => {
    const tab = el('button', { type: 'button', role: 'tab', className: 'story-tab', 'aria-selected': String(index === 0), text: label });
    tab.addEventListener('click', () => {
      list.querySelectorAll('[role="tab"]').forEach((other) => other.setAttribute('aria-selected', String(other === tab)));
      onSelect(index);
    });
    list.append(tab);
  });
  return list;
}

function renderBlock(block) {
  if (block.text) {
    return el('div', { className: 'story-block story-text', style: `--grow: ${block.ratio}` }, [
      el('span', { className: 'story-text-kicker', text: block.kicker }),
      el('h4', { text: block.heading }),
      el('p', { text: block.body }),
    ]);
  }

  if (block.stack) {
    const parts = block.stack.filter((part) => blockFigures(part).every((name) => storyFigure(name)));
    if (!parts.length) return null;
    return el('div', { className: 'story-block story-stack', style: `--grow: ${block.ratio}` }, parts.map(renderBlock));
  }

  const names = blockFigures(block).filter((name) => storyFigure(name));
  if (!names.length) return null;
  const body = el('div', { className: 'story-body' });
  const card = el('div', { className: 'story-block', style: `--grow: ${block.ratio}` }, [
    el('h4', { className: 'story-title', text: block.title || storyFigure(names[0]).title }),
  ]);

  if (block.groups) {
    const groups = block.groups
      .map(([label, tabs]) => [label, tabs.filter(([, name]) => storyFigure(name))])
      .filter(([, tabs]) => tabs.length);
    const variantSlot = el('div');
    const showGroup = (groupIndex) => {
      const tabs = groups[groupIndex][1];
      variantSlot.replaceChildren(renderTabs(tabs, (index) => renderFigureFrame(body, block, tabs[index][1])));
      renderFigureFrame(body, block, tabs[0][1]);
    };
    card.append(renderTabs(groups.map(([label]) => [label]), showGroup, 'story-tabs story-groups'), variantSlot, body);
    showGroup(0);
  } else if (block.tabs) {
    const tabs = block.tabs.filter(([, name]) => storyFigure(name));
    if (tabs.length > 1) card.append(renderTabs(tabs, (index) => renderFigureFrame(body, block, tabs[index][1])));
    card.append(body);
    renderFigureFrame(body, block, tabs[0][1]);
  } else {
    card.append(body);
    renderFigureFrame(body, block, names[0]);
  }
  return card;
}

function renderFigureStory(figures) {
  figures.forEach((figure) => story.byName.set(figure.name, figure));
  const known = new Set([...FIGURE_STORY.flatMap((chapter) => chapter.rows.flat().flatMap(blockFigures)), ...FIGURES_LEFT_OUT]);
  const extra = figures.filter((figure) => !known.has(figure.name));
  const chapters = [...FIGURE_STORY];
  if (extra.length) {
    // Pair new figures two by two; they are usually 16:9 PNGs like the rest.
    const rows = [];
    for (let index = 0; index < extra.length; index += 2) {
      rows.push(extra.slice(index, index + 2).map((figure) => ({ ratio: 1.78, figure: figure.name })));
    }
    chapters.push({ id: 'more', short: 'More', title: 'More figures', intro: 'The newest charts and maps.', rows });
  }

  chapters.forEach((chapter) => chapter.rows.flat().flatMap(blockFigures).forEach((name) => {
    if (storyFigure(name)) storyFigure(name).chapter = chapter.title;
  }));
  story.ordered = chapters.flatMap((chapter) => chapter.rows.flat().flatMap(blockFigures)).map(storyFigure).filter(Boolean);

  const nav = byId('figureNav');
  const container = byId('figureChapters');
  const sections = chapters.map((chapter, index) => {
    const rows = chapter.rows
      .map((row) => row.map(renderBlock).filter(Boolean))
      .filter((blocks) => blocks.length)
      .map((blocks) => el('div', { className: `story-row${blocks.length === 1 ? ' is-single' : ''}` }, blocks));
    return el('section', { className: 'story-chapter', id: `figures-${chapter.id}`, 'data-chapter': chapter.id }, [
      el('header', { className: 'story-chapter-head reveal' }, [
        el('span', { className: 'story-number', text: String(index + 1).padStart(2, '0') }),
        el('div', {}, [
          el('h3', { text: chapter.title }),
          el('p', { text: chapter.intro }),
        ]),
      ]),
      ...rows,
    ]);
  });
  container.replaceChildren(...sections);
  container.querySelectorAll('.reveal').forEach(observeReveal);

  nav.replaceChildren(...chapters.map((chapter, index) => el('a', {
    href: `#figures-${chapter.id}`,
    className: 'story-nav-link',
    'data-chapter': chapter.id,
    title: chapter.title,
  }, [el('span', { className: 'story-nav-number', text: String(index + 1).padStart(2, '0') }), chapter.short || chapter.title])));

  // Highlight the chapter in view, and keep its link visible in the scrolling menu.
  const links = new Map([...nav.querySelectorAll('a')].map((link) => [link.dataset.chapter, link]));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => link.classList.remove('is-active'));
      const link = links.get(entry.target.dataset.chapter);
      link.classList.add('is-active');
      nav.scrollTo({ left: link.offsetLeft - nav.clientWidth / 2 + link.clientWidth / 2, behavior: 'smooth' });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((section) => spy.observe(section));

  const header = document.querySelector('.site-header');
  const setHeaderHeight = () => document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
  setHeaderHeight();
  addEventListener('resize', setHeaderHeight);
}
