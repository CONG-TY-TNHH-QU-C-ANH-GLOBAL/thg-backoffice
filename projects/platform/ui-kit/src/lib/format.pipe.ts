import { Pipe, PipeTransform } from '@angular/core';

/**
 * ponytail: two tiny display pipes instead of pulling a date library.
 * Locale is fixed at the tenant level today; make it an input when the
 * platform ships to a second locale.
 */

const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

@Pipe({ name: 'boDateTime' })
export class DateTimePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    return isNaN(date.getTime()) ? '—' : DATE_TIME.format(date).replace(',', '');
  }
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

const RELATIVE = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });

@Pipe({ name: 'boRelativeTime' })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const diff = new Date(value).getTime() - Date.now();
    if (isNaN(diff)) return '—';
    for (const [unit, ms] of UNITS) {
      if (Math.abs(diff) >= ms) return RELATIVE.format(Math.round(diff / ms), unit);
    }
    return 'vừa xong';
  }
}

const CURRENCY = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

@Pipe({ name: 'boMoney' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null ? '—' : CURRENCY.format(value);
  }
}
