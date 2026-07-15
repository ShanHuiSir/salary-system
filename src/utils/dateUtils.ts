/**
 * 日期/月份处理工具
 *
 * 统一项目中多处重复的月份加减逻辑。
 * 月份格式统一为 YYYY-MM。
 */

/**
 * 月份加减运算
 *
 * @param month - YYYY-MM 格式的月份字符串
 * @param delta - 偏移量（正数为未来，负数为过去）
 * @returns 新月份字符串，无效输入返回空字符串
 *
 * @example
 * addMonths('2026-05', 1)   // '2026-06'
 * addMonths('2026-01', -1)  // '2025-12'
 * addMonths('2026-05', -12) // '2025-05'
 */
export function addMonths(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number);
  if (!year || !monthIndex) return '';
  const date = new Date(year, monthIndex - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 获取上一个月
 */
export function getPrevMonth(month: string): string {
  return addMonths(month, -1);
}

/**
 * 获取下一个月
 */
export function getNextMonth(month: string): string {
  return addMonths(month, 1);
}

/**
 * 获取去年同月
 */
export function getPrevYearMonth(month: string): string {
  return addMonths(month, -12);
}

/**
 * 获取明年同月
 */
export function getNextYearMonth(month: string): string {
  return addMonths(month, 12);
}

/**
 * 获取月份的中文标签
 *
 * @example
 * getMonthLabel('2026-05') // '2026年5月'
 */
export function getMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `${year}年${parseInt(m)}月`;
}

/**
 * 获取月份所在的年份
 */
export function getYear(month: string): number {
  return parseInt(month.split('-')[0]);
}

/**
 * 获取月份的数字部分
 */
export function getMonthNumber(month: string): number {
  return parseInt(month.split('-')[1]);
}

/**
 * 生成月份范围内的所有月份
 *
 * @example
 * getMonthsInRange('2026-01', '2026-03') // ['2026-01', '2026-02', '2026-03']
 */
export function getMonthsInRange(startMonth: string, endMonth: string): string[] {
  const result: string[] = [];
  let current = startMonth;
  while (current <= endMonth) {
    result.push(current);
    current = addMonths(current, 1);
  }
  return result;
}

/**
 * 判断月份是否在指定年份内
 */
export function isMonthInYear(month: string, year: number): boolean {
  return month.startsWith(`${year}-`);
}

/**
 * 从一组月份中获取最新月份
 */
export function getLatestMonth(months: string[]): string | undefined {
  return [...months].sort((a, b) => b.localeCompare(a))[0];
}

/**
 * 排序月份数组（从早到晚）
 */
export function sortMonthsAsc(months: string[]): string[] {
  return [...months].sort((a, b) => a.localeCompare(b));
}

/**
 * 排序月份数组（从晚到早）
 */
export function sortMonthsDesc(months: string[]): string[] {
  return [...months].sort((a, b) => b.localeCompare(a));
}
