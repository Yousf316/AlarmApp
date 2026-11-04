/**
 * Built-in coordinates so the local (adhan) fallback works for a city chosen
 * by name even before any successful API call. Key: 'cc:city' (lower case).
 */
const CITIES = {
  'sa:makkah': [21.4225, 39.8262, 'Asia/Riyadh'],
  'sa:mecca': [21.4225, 39.8262, 'Asia/Riyadh'],
  'sa:madinah': [24.4672, 39.6024, 'Asia/Riyadh'],
  'sa:medina': [24.4672, 39.6024, 'Asia/Riyadh'],
  'sa:jeddah': [21.5433, 39.1728, 'Asia/Riyadh'],
  'sa:riyadh': [24.7136, 46.6753, 'Asia/Riyadh'],
  'sa:dammam': [26.4207, 50.0888, 'Asia/Riyadh'],
  'sa:taif': [21.2703, 40.4158, 'Asia/Riyadh'],
  'sa:abha': [18.2164, 42.5053, 'Asia/Riyadh'],
  'sa:tabuk': [28.3838, 36.5662, 'Asia/Riyadh'],
  'eg:cairo': [30.0444, 31.2357, 'Africa/Cairo'],
  'eg:alexandria': [31.2001, 29.9187, 'Africa/Cairo'],
  'ae:dubai': [25.2048, 55.2708, 'Asia/Dubai'],
  'ae:abu dhabi': [24.4539, 54.3773, 'Asia/Dubai'],
  'kw:kuwait city': [29.3759, 47.9774, 'Asia/Kuwait'],
  'qa:doha': [25.2854, 51.531, 'Asia/Qatar'],
  'jo:amman': [31.9454, 35.9284, 'Asia/Amman'],
  'ps:jerusalem': [31.7683, 35.2137, 'Asia/Jerusalem'],
  'tr:istanbul': [41.0082, 28.9784, 'Europe/Istanbul'],
  'gb:london': [51.5074, -0.1278, 'Europe/London'],
  'us:new york': [40.7128, -74.006, 'America/New_York'],
  'pk:karachi': [24.8607, 67.0011, 'Asia/Karachi'],
  'id:jakarta': [-6.2088, 106.8456, 'Asia/Jakarta'],
};

/** @returns {{lat:number,lng:number,tz:string}|null} */
export const lookupCity = (city, country) => {
  const hit = CITIES[`${(country ?? '').toLowerCase()}:${(city ?? '').toLowerCase()}`];
  return hit ? {lat: hit[0], lng: hit[1], tz: hit[2]} : null;
};
