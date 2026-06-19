export function formatDateTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = toDate(date);
  if (!d) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const milliseconds = String(d.getMilliseconds()).padStart(3, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
    .replace('SSS', milliseconds);
}

export function formatDate(date, format = 'YYYY-MM-DD') {
  return formatDateTime(date, format);
}

export function formatTime(date, format = 'HH:mm:ss') {
  return formatDateTime(date, format);
}

export function formatRelative(date) {
  const d = toDate(date);
  if (!d) return '';

  const now = new Date();
  const diff = now - d;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return seconds <= 0 ? '刚刚' : `${seconds}秒前`;
  }
  if (minutes < 60) {
    return `${minutes}分钟前`;
  }
  if (hours < 24) {
    return `${hours}小时前`;
  }
  if (days < 7) {
    return `${days}天前`;
  }

  return formatDate(d);
}

export function formatDuration(seconds) {
  if (seconds < 60) {
    return `${Math.floor(seconds)}秒`;
  }
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}分${secs > 0 ? secs + '秒' : ''}`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${mins > 0 ? mins + '分' : ''}`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}天${hours > 0 ? hours + '小时' : ''}`;
}

export function getTimeDiff(date1, date2, unit = 'seconds') {
  const d1 = toDate(date1);
  const d2 = toDate(date2);
  if (!d1 || !d2) return 0;

  const diff = Math.abs(d2 - d1);

  switch (unit) {
    case 'milliseconds':
      return diff;
    case 'seconds':
      return Math.floor(diff / 1000);
    case 'minutes':
      return Math.floor(diff / (1000 * 60));
    case 'hours':
      return Math.floor(diff / (1000 * 60 * 60));
    case 'days':
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    default:
      return Math.floor(diff / 1000);
  }
}

export function isNightTime(date, nightStart = 22, nightEnd = 6) {
  const d = toDate(date);
  if (!d) return false;

  const hour = d.getHours();
  return hour >= nightStart || hour < nightEnd;
}

export function isDayTime(date, dayStart = 6, dayEnd = 22) {
  return !isNightTime(date, dayEnd, dayStart);
}

export function getTimeOfDay(date) {
  const d = toDate(date);
  if (!d) return 'unknown';

  const hour = d.getHours();

  if (hour >= 5 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 12) return 'forenoon';
  if (hour >= 12 && hour < 14) return 'noon';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

export function getTimeOfDayText(date) {
  const timeOfDay = getTimeOfDay(date);
  const texts = {
    morning: '清晨',
    forenoon: '上午',
    noon: '中午',
    afternoon: '下午',
    evening: '傍晚',
    night: '夜间',
    unknown: '',
  };
  return texts[timeOfDay] || '';
}

export function isToday(date) {
  const d = toDate(date);
  if (!d) return false;

  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export function isYesterday(date) {
  const d = toDate(date);
  if (!d) return false;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
}

export function isThisWeek(date) {
  const d = toDate(date);
  if (!d) return false;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return d >= weekStart && d < weekEnd;
}

export function isThisMonth(date) {
  const d = toDate(date);
  if (!d) return false;

  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function startOfDay(date) {
  const d = toDate(date);
  if (!d) return null;
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date) {
  const d = toDate(date);
  if (!d) return null;
  const result = new Date(d);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function startOfWeek(date, startOfWeek = 1) {
  const d = toDate(date);
  if (!d) return null;
  const result = new Date(d);
  const day = result.getDay();
  const diff = (day - startOfWeek + 7) % 7;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfWeek(date, startOfWeek = 1) {
  const start = startOfWeek(date, startOfWeek);
  if (!start) return null;
  const result = new Date(start);
  result.setDate(start.getDate() + 7);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function startOfMonth(date) {
  const d = toDate(date);
  if (!d) return null;
  const result = new Date(d.getFullYear(), d.getMonth(), 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfMonth(date) {
  const d = toDate(date);
  if (!d) return null;
  const result = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function addDays(date, days) {
  const d = toDate(date);
  if (!d) return null;
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

export function addHours(date, hours) {
  const d = toDate(date);
  if (!d) return null;
  const result = new Date(d);
  result.setHours(result.getHours() + hours);
  return result;
}

export function addMinutes(date, minutes) {
  const d = toDate(date);
  if (!d) return null;
  const result = new Date(d);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

export function getWeekday(date) {
  const d = toDate(date);
  if (!d) return -1;
  return d.getDay();
}

export function getWeekdayText(date, short = false) {
  const weekday = getWeekday(date);
  const weekdays = short
    ? ['日', '一', '二', '三', '四', '五', '六']
    : ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return weekdays[weekday] || '';
}

export function getTimestamp(date) {
  const d = toDate(date);
  return d ? d.getTime() : 0;
}

function toDate(date) {
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof date === 'string' || typeof date === 'number') {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export default {
  formatDateTime,
  formatDate,
  formatTime,
  formatRelative,
  formatDuration,
  getTimeDiff,
  isNightTime,
  isDayTime,
  getTimeOfDay,
  getTimeOfDayText,
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addHours,
  addMinutes,
  getWeekday,
  getWeekdayText,
  getTimestamp,
};
