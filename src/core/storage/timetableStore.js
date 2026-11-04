import {getJSON, setJSON} from './mmkv';

const KEY = 'timetable';

/** Persistence for prayer/timetableRepo. */
export const timetableStore = {
  load: () => getJSON(KEY, null),
  save: timetable => setJSON(KEY, timetable),
};
