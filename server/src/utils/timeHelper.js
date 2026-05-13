const DAYS_ID = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

function getWIBDate() {
  // Returns current date/time in WIB (UTC+7)
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib;
}

function getTodayWIB() {
  // Returns YYYY-MM-DD string in WIB
  const wib = getWIBDate();
  return wib.toISOString().split('T')[0];
}

function getCurrentTimeWIB() {
  // Returns HH:MM string in WIB
  const wib = getWIBDate();
  const hh = String(wib.getUTCHours()).padStart(2, '0');
  const mm = String(wib.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getTodayDayNameWIB() {
  // Returns day name in Indonesian lowercase
  const wib = getWIBDate();
  return DAYS_ID[wib.getUTCDay()];
}

function isShiftActive(schedule) {
  // schedule: { hari, jam_mulai, jam_selesai }
  const today = getTodayDayNameWIB();
  const now = getCurrentTimeWIB();
  return schedule.hari === today && schedule.jam_mulai <= now && now < schedule.jam_selesai;
}

module.exports = { getTodayWIB, getCurrentTimeWIB, getTodayDayNameWIB, isShiftActive, getWIBDate };
