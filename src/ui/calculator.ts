import { calcDisplay, type CalcKey, type CalcState } from '../core/calculator';
import { h } from './dom';
import { t, type UiKey } from './text';

/** Button rows: key, visible label, read-aloud label (digits read themselves). */
const ROWS: [CalcKey, UiKey | null, UiKey | null][][] = [
  [['7', null, null], ['8', null, null], ['9', null, null], ['/', 'calculator.divide', 'aria.calcDivide']],
  [['4', null, null], ['5', null, null], ['6', null, null], ['*', 'calculator.multiply', 'aria.calcMultiply']],
  [['1', null, null], ['2', null, null], ['3', null, null], ['-', 'calculator.subtract', 'aria.calcSubtract']],
  [['0', null, null], [',', 'calculator.decimal', 'aria.calcDecimal'], ['=', 'calculator.equals', 'aria.calcEquals'], ['+', 'calculator.add', 'aria.calcAdd']],
  [['C', 'calculator.clear', 'aria.calcClear'], ['back', 'calculator.backspace', 'aria.calcBackspace']],
];

const KEY_NAMES: Partial<Record<CalcKey, string>> = { '/': 'div', '*': 'mul', '-': 'sub', '+': 'add', ',': 'comma', '=': 'eq', C: 'clear', back: 'back' };

/**
 * Desk calculator (SPEC 7). Mouse and keyboard; the keys are handled for the
 * whole desk in app.ts while the calculator lies open. It never fills in the Prüfvermerk.
 */
export function renderCalculator(state: CalcState, onKey: (key: CalcKey) => void): HTMLElement {
  const shown = calcDisplay(state);
  const el = h(
    'section',
    { class: 'calculator', tabindex: 0, 'data-key': 'calc', 'aria-label': t('aria.calculator') },
    h('h2', {}, t('calculator.heading')),
    h('output', { class: `calc-display${shown === null ? ' error' : ''}`, 'aria-live': 'polite', 'aria-label': t('aria.calcDisplay') }, shown ?? t('calculator.error')),
    h(
      'div',
      { class: 'calc-keys' },
      ROWS.flat().map(([key, label, aria]) =>
        h(
          'button',
          {
            class: `calc-key${/^[0-9,]$/.test(key) ? '' : ' op'}${key === 'C' ? ' clear' : ''}${key === 'back' ? ' back' : ''}`,
            'data-key': `calc-${KEY_NAMES[key] ?? key}`,
            'aria-label': aria ? t(aria) : null,
            onclick: () => onKey(key),
          },
          label ? t(label) : key,
        ),
      ),
    ),
  );
  return el;
}
