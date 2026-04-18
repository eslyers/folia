// Feriados Nacionais Brasileiros 2026-2029
// Feriados fixos + cálculos de Páscoa/Carnaval via date-fns

import {
  getDay,
  addDays,
  subDays,
  addMonths,
  setDate,
  getMonth,
  getYear,
} from "date-fns";

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  type: "national" | "optional";
}

// Computes Easter Sunday using the Anonymous Gregorian algorithm
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function buildHoliday(date: Date, name: string, type: "national" | "optional"): Holiday {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, name, type };
}

// Generate all holidays for a given year
function generateYearHolidays(year: number): Holiday[] {
  const easter = getEasterSunday(year);

  return [
    // Fixos Nacionais
    buildHoliday(new Date(year, 0, 1), "Confraternização Universal", "national"),                    // 1º Jan
    buildHoliday(new Date(year, 3, 21), "Tiradentes", "national"),                                  // 21 Abr
    buildHoliday(new Date(year, 4, 1), "Dia do Trabalho", "national"),                                // 1º Mai
    buildHoliday(new Date(year, 8, 7), "Independência do Brasil", "national"),                       // 7 Set
    buildHoliday(new Date(year, 9, 12), "Nossa Senhora Aparecida", "national"),                      // 12 Out
    buildHoliday(new Date(year, 10, 2), "Finados", "national"),                                     // 2 Nov
    buildHoliday(new Date(year, 10, 15), "Proclamação da República", "national"),                   // 15 Nov
    buildHoliday(new Date(year, 11, 25), "Natal", "national"),                                     // 25 Dez

    // Moveis Nacionais
    buildHoliday(subDays(easter, 48), "Carnaval", "optional"),                                      // 48 dias antes (terça-feira)
    buildHoliday(subDays(easter, 47), "Carnaval", "optional"),                                      // 47 dias antes (quarta de cinzas)
    buildHoliday(subDays(easter, 2), "Sexta-feira Santa", "national"),                             // 2 dias antes
    buildHoliday(easter, "Páscoa", "national"),                                                    // Domingo de Páscoa
    buildHoliday(addDays(easter, 60), "Corpus Christi", "optional"),                                // 60 dias depois
  ];
}

// Generate holidays for years 2026-2029
function generateAllHolidays(): Holiday[] {
  return [
    ...generateYearHolidays(2026),
    ...generateYearHolidays(2027),
    ...generateYearHolidays(2028),
    ...generateYearHolidays(2029),
  ];
}

export const BRAZILIAN_HOLIDAYS: Holiday[] = generateAllHolidays();

// Check if a date string (YYYY-MM-DD) is a holiday
export function isHoliday(dateStr: string): Holiday | null {
  return BRAZILIAN_HOLIDAYS.find((h) => h.date === dateStr) || null;
}

// Get all holidays for a given year (YYYY format)
export function getHolidaysForYear(year: number): Holiday[] {
  return BRAZILIAN_HOLIDAYS.filter((h) => h.date.startsWith(String(year)));
}

// Get all holidays for a given month (YYYY-MM format)
export function getHolidaysForMonth(yearMonth: string): Holiday[] {
  return BRAZILIAN_HOLIDAYS.filter((h) => h.date.startsWith(yearMonth));
}

// Check if a date range contains holidays
export function getHolidaysInRange(startDate: string, endDate: string): Holiday[] {
  return BRAZILIAN_HOLIDAYS.filter(
    (h) => h.date >= startDate && h.date <= endDate
  );
}
