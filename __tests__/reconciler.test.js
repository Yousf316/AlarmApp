/* eslint-env jest */
import {diffSchedule, pruneScheduled, reconcile, resetSchedule} from '../src/core/alarms/reconciler';
import {buildDesired} from '../src/core/alarms/window';
import {normalizeAlarm} from '../src/core/alarms/model';
import {addDays} from '../src/core/time/zone';

const TZ = 'Asia/Riyadh';
const at = (dateKey, hh) => Date.parse(`${dateKey}T${hh}:00:00+03:00`);
const NOW = at('2026-11-03', '00');

const timetable = nDays => ({
  tz: TZ,
  days: Object.fromEntries(
    Array.from({length: nDays}, (_, i) => {
      const key = addDays('2026-11-04', i, TZ);
      return [key, {Fajr: at(key, '04'), Dhuhr: at(key, '11'), Asr: at(key, '15'), Maghrib: at(key, '17'), Isha: at(key, '19')}];
    }),
  ),
});

const alarm = (over = {}) =>
  normalizeAlarm({id: 'a1', prayer: 'Fajr', kind: 'before', offsetMin: 10, ...over});

const desiredFor = (alarms, over = {}) =>
  buildDesired({alarms, timetable: timetable(3), platform: 'ios', now: NOW, ...over}).desired;

const makeStore = (initial = {}) => {
  let map = initial;
  return {loadMap: () => map, saveMap: m => (map = m), get: () => map};
};

const makeAdapter = ({pending = null} = {}) => ({
  listPending: pending ? jest.fn(async () => pending()) : null,
  schedule: jest.fn(async () => true),
  cancel: jest.fn(async () => true),
  cancelAll: jest.fn(async () => true),
});

describe('diffSchedule', () => {
  it('schedules new, cancels removed, replaces changed fingerprints, leaves the rest', () => {
    const scheduled = {
      keep: {fingerprint: 'f1'},
      change: {fingerprint: 'old'},
      gone: {fingerprint: 'f3'},
    };
    const desired = [
      {id: 'keep', fingerprint: 'f1'},
      {id: 'change', fingerprint: 'new'},
      {id: 'added', fingerprint: 'f4'},
    ];
    const {toCancel, toSchedule} = diffSchedule({desired, scheduled});
    expect(toCancel.sort()).toEqual(['change', 'gone']);
    expect(toSchedule.map(i => i.id).sort()).toEqual(['added', 'change']);
  });
});

describe('reconcile', () => {
  it('first run schedules everything, second run touches nothing', async () => {
    const store = makeStore();
    const desired = desiredFor([alarm()]);
    const adapter = makeAdapter({pending: () => Object.keys(store.get())});

    const first = await reconcile({desired, adapter, store, now: NOW});
    expect(first.scheduled).toBe(desired.length);
    expect(adapter.schedule).toHaveBeenCalledTimes(desired.length);

    adapter.schedule.mockClear();
    const second = await reconcile({desired, adapter, store, now: NOW});
    expect(second).toMatchObject({scheduled: 0, cancelled: 0, kept: desired.length});
    expect(adapter.schedule).not.toHaveBeenCalled();
    expect(adapter.cancel).not.toHaveBeenCalled();
  });

  it('same id with another offsetMin is cancelled and scheduled again', async () => {
    const store = makeStore();
    const adapter = makeAdapter({pending: () => Object.keys(store.get())});
    await reconcile({desired: desiredFor([alarm({offsetMin: 10})]), adapter, store, now: NOW});
    adapter.schedule.mockClear();

    const changed = desiredFor([alarm({offsetMin: 25})]);
    const result = await reconcile({desired: changed, adapter, store, now: NOW});

    const alarms = changed.filter(d => d.type === 'alarm');
    expect(adapter.cancel.mock.calls.map(([e]) => e.id)).toEqual(
      expect.arrayContaining(alarms.map(a => a.id)),
    );
    expect(result.scheduled).toBeGreaterThanOrEqual(alarms.length);
    // the ids did not change, only the registration was refreshed
    expect(alarms.every(a => store.get()[a.id].fireAt === a.fireAt)).toBe(true);
  });

  it('same id with another sound or snooze setting is replaced too', async () => {
    const store = makeStore();
    const adapter = makeAdapter({pending: () => Object.keys(store.get())});
    await reconcile({desired: desiredFor([alarm()]), adapter, store, now: NOW});

    for (const over of [{soundId: 'adhan1'}, {snoozeMin: 9}, {maxSnooze: 1}]) {
      adapter.cancel.mockClear();
      adapter.schedule.mockClear();
      await reconcile({desired: desiredFor([alarm(over)]), adapter, store, now: NOW});
      expect(adapter.schedule).toHaveBeenCalled();
      // restore so the next case starts from the base alarm
      await reconcile({desired: desiredFor([alarm()]), adapter, store, now: NOW});
    }
  });

  it('removing an alarm cancels only its occurrences', async () => {
    const store = makeStore();
    const adapter = makeAdapter({pending: () => Object.keys(store.get())});
    const both = [alarm({id: 'fajr'}), alarm({id: 'isha', prayer: 'Isha'})];
    await reconcile({desired: desiredFor(both), adapter, store, now: NOW});
    adapter.cancel.mockClear();

    await reconcile({desired: desiredFor([both[0]]), adapter, store, now: NOW});

    const cancelled = adapter.cancel.mock.calls.map(([e]) => e.id);
    expect(cancelled.filter(id => id.startsWith('isha|'))).toHaveLength(3);
    expect(cancelled.filter(id => id.startsWith('fajr|'))).toEqual([]);
    expect(Object.keys(store.get()).some(id => id.startsWith('isha|'))).toBe(false);
  });

  it('iOS: re-schedules what the system no longer has pending', async () => {
    const desired = desiredFor([alarm()]);
    const store = makeStore(
      Object.fromEntries(desired.map(d => [d.id, {fingerprint: d.fingerprint, fireAt: d.fireAt}])),
    );
    const dropped = desired[0].id;
    const adapter = makeAdapter({pending: () => desired.map(d => d.id).filter(id => id !== dropped)});

    const result = await reconcile({desired, adapter, store, now: NOW});

    expect(result.scheduled).toBe(1);
    expect(adapter.schedule.mock.calls[0][0].id).toBe(dropped);
  });

  it('Android: forgets entries whose time has passed without cancelling them', () => {
    const scheduled = {
      past: {fingerprint: 'x', fireAt: NOW - 1000},
      future: {fingerprint: 'y', fireAt: NOW + 1000},
    };
    expect(Object.keys(pruneScheduled({scheduled, pendingIds: null, now: NOW}))).toEqual(['future']);
  });

  it('a failed cancel stays on record and is reported; a failed schedule is not recorded', async () => {
    const store = makeStore({stale: {fingerprint: 'f', fireAt: NOW + 1, nid: 7, type: 'alarm'}});
    const desired = desiredFor([alarm()]);
    const adapter = makeAdapter();
    adapter.cancel.mockRejectedValueOnce(new Error('boom'));
    adapter.schedule.mockRejectedValueOnce(new Error('nope'));

    const result = await reconcile({desired, adapter, store, now: NOW});

    expect(result.cancelErrors.map(e => e.id)).toEqual(['stale']);
    expect(store.get().stale).toBeDefined();
    expect(result.scheduleErrors).toHaveLength(1);
    expect(store.get()[result.scheduleErrors[0].id]).toBeUndefined();
    expect(result.scheduled).toBe(desired.length - 1);
  });

  it('hands the platform the data it needs to cancel (nid and type)', async () => {
    const store = makeStore({x: {fingerprint: 'f', fireAt: NOW + 1, nid: 42, type: 'alarm'}});
    const adapter = makeAdapter();
    await reconcile({desired: [], adapter, store, now: NOW});
    expect(adapter.cancel).toHaveBeenCalledWith({id: 'x', fingerprint: 'f', fireAt: NOW + 1, nid: 42, type: 'alarm'});
  });
});

describe('resetSchedule', () => {
  it('cancels everything and forgets the record', async () => {
    const store = makeStore({a: {fingerprint: 'f'}});
    const adapter = makeAdapter();
    await resetSchedule({adapter, store});
    expect(adapter.cancelAll).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({});
  });
});
