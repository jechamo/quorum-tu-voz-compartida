/**
 * Gets the Monday of the current week
 * @returns ISO date string (YYYY-MM-DD) for the Monday of the current week
 */
export const getCurrentWeekStart = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // Calculate days to subtract to get to Monday (day 1)
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().split('T')[0];
};
