/**
 * Brings what the OS has registered in line with what should be registered,
 * touching only what differs (never "cancel everything, add everything").
 *
 * `scheduled` is the app's record of what it registered:
 *   { [id]: {fingerprint, fireAt, nid, type} }
 * `desired` is a list of {id, nid, type, fireAt, fingerprint, …}.
 */

/**
 * - in `scheduled` but no longer wanted            → cancel
 * - same id, different fingerprint (time, sound,
 *   snooze settings … changed)                      → cancel, then schedule again
 * - wanted but not in `scheduled`                    → schedule
 */
export const diffSchedule = ({desired, scheduled}) => {
  const wanted = new Map(desired.map(item => [item.id, item]));
  const toCancel = [];
  for (const [id, entry] of Object.entries(scheduled)) {
    const item = wanted.get(id);
    if (!item || item.fingerprint !== entry.fingerprint) {
      toCancel.push(id);
    }
  }
  const toSchedule = desired.filter(
    item => !scheduled[item.id] || scheduled[item.id].fingerprint !== item.fingerprint,
  );
  return {toCancel, toSchedule};
};

/**
 * Forget what is no longer pending. iOS tells us exactly (`pendingIds`): an
 * alarm that fired, or that the system dropped, is gone. Android has no such
 * query, so entries whose time has passed are dropped.
 */
export const pruneScheduled = ({scheduled, pendingIds, now}) => {
  const kept = {};
  for (const [id, entry] of Object.entries(scheduled)) {
    const stillPending = pendingIds ? pendingIds.has(id) : entry.fireAt > now;
    if (stillPending) {
      kept[id] = entry;
    }
  }
  return kept;
};

/**
 * @param {object} args
 * @param {Array} args.desired
 * @param {{listPending?:()=>Promise<string[]>, cancel:(entry)=>Promise<any>,
 *          schedule:(item)=>Promise<any>}} args.adapter platform operations
 * @param {{loadMap:()=>object, saveMap:(map:object)=>void}} args.store
 * @returns {Promise<{scheduled:number, cancelled:number, kept:number,
 *   cancelErrors:Array<{id:string,error:any}>, scheduleErrors:Array<{id:string,error:any}>}>}
 */
export const reconcile = async ({desired, adapter, store, now = Date.now()}) => {
  const pendingIds = adapter.listPending ? new Set(await adapter.listPending()) : null;
  const scheduled = pruneScheduled({scheduled: store.loadMap(), pendingIds, now});
  const {toCancel, toSchedule} = diffSchedule({desired, scheduled});

  const next = {...scheduled};
  const result = {
    scheduled: 0,
    cancelled: 0,
    kept: desired.length - toSchedule.length,
    cancelErrors: [],
    scheduleErrors: [],
  };

  try {
    for (const id of toCancel) {
      try {
        await adapter.cancel({id, ...scheduled[id]});
        delete next[id];
        result.cancelled++;
      } catch (error) {
        // Still registered with the OS: keep it on record so it is retried.
        result.cancelErrors.push({id, error});
      }
    }
    for (const item of toSchedule) {
      try {
        await adapter.schedule(item);
        next[item.id] = {
          fingerprint: item.fingerprint,
          fireAt: item.fireAt,
          nid: item.nid,
          type: item.type,
        };
        result.scheduled++;
      } catch (error) {
        result.scheduleErrors.push({id: item.id, error});
      }
    }
  } finally {
    store.saveMap(next);
  }
  return result;
};

/** Cancel everything the app registered and forget it (keeps pending snoozes on iOS). */
export const resetSchedule = async ({adapter, store}) => {
  await adapter.cancelAll();
  store.saveMap({});
};
