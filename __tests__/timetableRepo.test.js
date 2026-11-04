/* eslint-env jest */
import {DateTime} from 'luxon';
import {
  coverageDays,
  getTimetable,
  MIN_COVERAGE_DAYS,
  needsRefresh,
  timetableKey,
} from '../src/core/prayer/timetableRepo';
import {normalizeEntry} from '../src/core/prayer/aladhan';
import {planOccurrences} from '../src/core/alarms/planner';
import {normalizeAlarm} from '../src/core/alarms/model';

const DAY = 24 * 60 * 60 * 1000;
const TZ = 'Asia/Riyadh';
const JEDDAH = {city: 'Jeddah', country: 'SA'};
const NOW = Date.parse('2026-11-04T06:00:00Z');

const memoryStore = initial => {
  let value = initial ?? null;
  return {
    load: jest.fn(() => value),
    save: jest.fn(t => {
      value = t;
    }),
    get value() {
      return value;
    },
  };
};

const entry = (dateKey, shift = 0) => {
  const [y, m, d] = dateKey.split('-');
  const t = (hh, mm) => `${dateKey}T${hh}:${String(mm + shift).padStart(2, '0')}:00+03:00`;
  return {
    timings: {Fajr: t('05', 0), Dhuhr: t('12', 0), Asr: t('15', 0), Maghrib: t('17', 30), Isha: t('19', 0)},
    date: {gregorian: {date: `${d}-${m}-${y}`}},
    meta: {timezone: TZ, latitude: 21.5433, longitude: 39.1728},
  };
};

/** Annual response body in Aladhan's shape: { "1": [...], … "12": [...] }. */
const yearBody = year => {
  const data = {};
  for (let dt = DateTime.utc(year, 1, 1); dt.year === year; dt = dt.plus({days: 1})) {
    (data[dt.month] ??= []).push(entry(dt.toFormat('yyyy-LL-dd')));
  }
  return {code: 200, status: 'OK', data};
};

const okFetch = () =>
  jest.fn(async url => {
    const year = Number(/\/(calendar|calendarByCity)\/(\d{4})/.exec(url)[2]);
    return {ok: true, json: async () => yearBody(year)};
  });

const failingFetch = () =>
  jest.fn(async () => {
    throw new Error('offline');
  });

describe('getTimetable – API path', () => {
  it('fetches the whole year in one request and stores it', async () => {
    const store = memoryStore();
    const fetchImpl = okFetch();
    const res = await getTimetable({location: JEDDAH, now: NOW, store, fetchImpl});

    expect(res.status).toBe('api');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = fetchImpl.mock.calls[0][0];
    expect(url).toContain('/calendarByCity/2026');
    expect(url).toContain('annual=true');
    expect(url).toContain('method=4'); // Umm Al-Qura by default
    expect(res.timetable.tz).toBe(TZ);
    expect(res.timetable.key).toBe(timetableKey(JEDDAH));
    expect(coverageDays(res.timetable, NOW)).toBeGreaterThanOrEqual(MIN_COVERAGE_DAYS);
    expect(store.save).toHaveBeenCalledTimes(1);
    // exact instants, not local strings
    expect(res.timetable.days['2026-11-04'].Fajr).toBe(Date.parse('2026-11-04T05:00:00+03:00'));
  });

  it('uses lat/lng endpoint for GPS locations', async () => {
    const fetchImpl = okFetch();
    await getTimetable({location: {lat: 24.7, lng: 46.7}, now: NOW, store: memoryStore(), fetchImpl});
    expect(fetchImpl.mock.calls[0][0]).toContain('/calendar/2026?latitude=24.7&longitude=46.7');
  });

  it('also fetches next year when this one runs out soon', async () => {
    const fetchImpl = okFetch();
    const now = Date.parse('2026-12-20T06:00:00Z');
    const res = await getTimetable({location: JEDDAH, now, store: memoryStore(), fetchImpl});
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toContain('/2027');
    expect(coverageDays(res.timetable, now)).toBeGreaterThanOrEqual(MIN_COVERAGE_DAYS);
  });

  it('serves fresh data from the cache without any request', async () => {
    const store = memoryStore();
    await getTimetable({location: JEDDAH, now: NOW, store, fetchImpl: okFetch()});
    const fetchImpl = okFetch();
    const res = await getTimetable({location: JEDDAH, now: NOW + DAY, store, fetchImpl});
    expect(res.status).toBe('cached');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refetches when forced, when the method changes or the city changes', async () => {
    const store = memoryStore();
    await getTimetable({location: JEDDAH, now: NOW, store, fetchImpl: okFetch()});

    const forced = okFetch();
    await getTimetable({location: JEDDAH, now: NOW, store, fetchImpl: forced, force: true});
    expect(forced).toHaveBeenCalled();

    const otherMethod = okFetch();
    await getTimetable({location: JEDDAH, method: 'Egyptian', now: NOW, store, fetchImpl: otherMethod});
    expect(otherMethod.mock.calls[0][0]).toContain('method=5');

    const otherCity = okFetch();
    await getTimetable({location: {city: 'Cairo', country: 'EG'}, now: NOW, store, fetchImpl: otherCity});
    expect(otherCity).toHaveBeenCalled();
  });

  it('refetches once coverage drops below the threshold', async () => {
    const store = memoryStore();
    await getTimetable({location: JEDDAH, now: NOW, store, fetchImpl: okFetch()});
    const later = Date.parse('2026-12-25T06:00:00Z'); // < 45 days of 2026 left, 2027 not stored
    const fetchImpl = okFetch();
    await getTimetable({location: JEDDAH, now: later, store, fetchImpl});
    expect(fetchImpl).toHaveBeenCalled();
  });
});

describe('getTimetable – fallbacks', () => {
  it('API down → computes offline for a known city', async () => {
    const store = memoryStore();
    const res = await getTimetable({location: JEDDAH, now: NOW, store, fetchImpl: failingFetch()});
    expect(res.status).toBe('local');
    expect(res.error).toBe('offline');
    expect(res.timetable.source).toBe('local');
    expect(coverageDays(res.timetable, NOW)).toBeGreaterThanOrEqual(100);
    expect(store.value.key).toBe(timetableKey(JEDDAH));
  });

  it('HTTP errors and API error bodies count as failures', async () => {
    const http = jest.fn(async () => ({ok: false, status: 503, json: async () => ({})}));
    const body = jest.fn(async () => ({ok: true, json: async () => ({code: 400, status: 'Bad'})}));
    for (const fetchImpl of [http, body]) {
      const res = await getTimetable({location: JEDDAH, now: NOW, store: memoryStore(), fetchImpl});
      expect(res.status).toBe('local');
    }
  });

  it('a malformed/empty response falls back too', async () => {
    const fetchImpl = jest.fn(async () => ({ok: true, json: async () => ({code: 200, data: {}})}));
    const res = await getTimetable({location: JEDDAH, now: NOW, store: memoryStore(), fetchImpl});
    expect(res.status).toBe('local');
  });

  it('keeps API days over computed ones when refreshing offline', async () => {
    const store = memoryStore();
    await getTimetable({location: JEDDAH, now: NOW, store, fetchImpl: okFetch()});
    const apiFajr = store.value.days['2026-11-10'].Fajr;

    const res = await getTimetable({
      location: JEDDAH,
      now: NOW,
      store,
      fetchImpl: failingFetch(),
      force: true,
    });
    expect(res.status).toBe('local');
    expect(res.timetable.source).toBe('mixed');
    expect(res.timetable.days['2026-11-10'].Fajr).toBe(apiFajr);
  });

  it('API ok but next year missing → tops up with offline days', async () => {
    const fetchImpl = jest.fn(async url => {
      if (url.includes('/2027')) {
        throw new Error('offline');
      }
      return {ok: true, json: async () => yearBody(2026)};
    });
    const now = Date.parse('2026-12-20T06:00:00Z');
    const res = await getTimetable({location: JEDDAH, now, store: memoryStore(), fetchImpl});
    expect(res.timetable.source).toBe('mixed');
    expect(coverageDays(res.timetable, now)).toBeGreaterThanOrEqual(MIN_COVERAGE_DAYS);
  });

  it('unknown city, no cache, no network → null', async () => {
    const res = await getTimetable({
      location: {city: 'Atlantis', country: 'XX'},
      now: NOW,
      store: memoryStore(),
      fetchImpl: failingFetch(),
    });
    expect(res).toBeNull();
  });

  it('unknown city but a cache with data → stale cache', async () => {
    const location = {city: 'Atlantis', country: 'XX'};
    const cached = {
      key: timetableKey(location),
      tz: TZ,
      source: 'api',
      days: {'2026-11-04': {Fajr: 1, Dhuhr: 2, Asr: 3, Maghrib: 4, Isha: 5}},
    };
    const res = await getTimetable({
      location,
      now: NOW,
      store: memoryStore(cached),
      fetchImpl: failingFetch(),
    });
    expect(res.status).toBe('stale');
    expect(res.timetable).toBe(cached);
  });

  it('API-only method with no network does not invent times', async () => {
    const res = await getTimetable({
      location: JEDDAH,
      method: 'Gulf',
      now: NOW,
      store: memoryStore(),
      fetchImpl: failingFetch(),
    });
    expect(res).toBeNull();
  });

  it('GPS location offline uses the supplied coordinates', async () => {
    const res = await getTimetable({
      location: {lat: 21.5, lng: 39.2, tz: TZ},
      now: NOW,
      store: memoryStore(),
      fetchImpl: failingFetch(),
    });
    expect(res.status).toBe('local');
    expect(res.timetable.tz).toBe(TZ);
  });
});

describe('needsRefresh', () => {
  it('reports why', async () => {
    expect(needsRefresh({timetable: null, location: JEDDAH, now: NOW})).toBe('empty');
    const store = memoryStore();
    const {timetable} = await getTimetable({location: JEDDAH, now: NOW, store, fetchImpl: okFetch()});
    expect(needsRefresh({timetable, location: JEDDAH, now: NOW})).toBeNull();
    expect(needsRefresh({timetable, location: {city: 'Cairo', country: 'EG'}, now: NOW})).toBe(
      'location-or-method-changed',
    );
    expect(needsRefresh({timetable, location: JEDDAH, method: 'Karachi', now: NOW})).toBe(
      'location-or-method-changed',
    );
    expect(needsRefresh({timetable, location: JEDDAH, now: NOW + 330 * DAY})).toBe('low-coverage');
  });

  it('GPS keys tolerate tiny movement but not a new city', () => {
    expect(timetableKey({lat: 21.541, lng: 39.171})).toBe(timetableKey({lat: 21.549, lng: 39.179}));
    expect(timetableKey({lat: 21.5, lng: 39.2})).not.toBe(timetableKey({lat: 24.7, lng: 46.7}));
  });
});

describe('normalizeEntry', () => {
  it('rejects days with a missing prayer', () => {
    const bad = entry('2026-11-04');
    delete bad.timings.Isha;
    expect(normalizeEntry(bad)).toBeNull();
    expect(normalizeEntry(entry('2026-11-04')).dateKey).toBe('2026-11-04');
  });
});

describe('end to end: offline timetable → plan', () => {
  it('plans 20 days of "30 min before Fajr" without any network', async () => {
    const { timetable } = await getTimetable({
      location: JEDDAH,
      now: NOW,
      store: memoryStore(),
      fetchImpl: failingFetch(),
    });
    const alarm = normalizeAlarm({id: 'a', prayer: 'Fajr', offsetMin: 30});
    const plan = planOccurrences({alarms: [alarm], timetable, now: NOW});
    expect(plan.length).toBeGreaterThanOrEqual(110);
    const sample = plan[0];
    expect(sample.fireAt).toBeGreaterThan(NOW);
    expect(sample.fireAt).toBe(timetable.days[sample.dateKey].Fajr - 30 * 60 * 1000);
  });
});
