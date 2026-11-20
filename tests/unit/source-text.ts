import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseAst } from 'rolldown/parseAst';

/**
 * Finds string literals in `src/` that look like text a player reads or a
 * screen reader announces. Works on the syntax tree (rolldown's TypeScript
 * parser), not on regexes over the source.
 */

export const SRC = join(__dirname, '..', '..', 'src');

export interface Literal {
  file: string;
  line: number;
  /** Literal value; template literals with `{}` where an expression sits. */
  value: string;
  /** True when the literal lands directly in the DOM as text or as a read-aloud attribute. */
  sink: boolean;
  /** Why the literal is technical, if it is (see `technicalReason`). */
  technical: string | null;
  /** Call this literal is an argument of, e.g. `t` or `h`. */
  callee: string | null;
  argIndex: number;
  /** Names of all enclosing calls and `new` expressions, outermost first (e.g. `new ContentError`). */
  within: string[];
  /** For the key of a `t(key, { … })` call: the parameter names passed, sorted. */
  params: string[] | null;
  node: Node;
}

interface Node {
  type: string;
  start: number;
  end: number;
  [k: string]: unknown;
}

export function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.ts$/.test(f) && !/\.d\.ts$/.test(f) ? [p] : [];
  });
}

/** Attributes whose value is shown or read aloud. */
const TEXT_ATTRS = new Set(['aria-label', 'aria-roledescription', 'aria-valuetext', 'aria-description', 'placeholder', 'title', 'alt']);
/** Properties whose assignment puts text into the DOM. */
const TEXT_PROPS = new Set(['textContent', 'innerText', 'innerHTML', 'outerHTML', 'title', 'placeholder', 'ariaLabel', 'value']);
/** Browser dialogs that show their argument. */
const TEXT_CALLS = new Set(['confirm', 'alert', 'prompt']);
/** DOM APIs that take text: `append(…)`, `insertAdjacentText(…)`, `createTextNode(…)`. */
const TEXT_METHODS = new Set(['append', 'prepend', 'replaceChildren', 'insertAdjacentText', 'insertAdjacentHTML', 'createTextNode', 'write']);

const isNode = (v: unknown): v is Node => !!v && typeof v === 'object' && typeof (v as Node).type === 'string';

function calleeName(call: Node): string | null {
  const c = call.callee as Node;
  if (c.type === 'Identifier') return c.name as string;
  if (c.type === 'MemberExpression' && !c.computed) return ((c.property as Node).name as string) ?? null;
  return null;
}

function lineOf(src: string, pos: number): number {
  let n = 1;
  for (let i = 0; i < pos; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

/**
 * Technical contexts: the literal is code, not text. Each entry says why.
 * Checked from the literal outwards through its parents.
 */
function technicalReason(stack: Node[], self: Node): string | null {
  const parent = stack[stack.length - 1]!;
  // Comparisons (`e.key === 'Enter'`, `case 'desk':`) match values, they do not show them.
  if (parent.type === 'BinaryExpression' && ['===', '!==', '==', '!=', 'in'].includes(parent.operator as string)) return 'Vergleich';
  if (parent.type === 'SwitchCase' && parent.test === self) return 'Vergleich';
  // h('tag', …): the first argument is the element name.
  if (parent.type === 'CallExpression' && calleeName(parent) === 'h' && (parent.arguments as Node[])[0] === self) return 'Elementname';
  // Attribute values in h(…, { class: '…', 'data-key': '…' }) other than text attributes.
  if (parent.type === 'Property' && parent.value === self) {
    const k = parent.key as Node;
    const name = (k.type === 'Identifier' ? k.name : k.value) as string;
    if (!TEXT_ATTRS.has(name)) return `Attribut ${name}`;
  }
  // `x.name = 'ContentError'`, `el.style.transform = …`: properties that are not text.
  if (parent.type === 'AssignmentExpression' && parent.right === self) {
    const l = parent.left as Node;
    if (l.type === 'MemberExpression' && !TEXT_PROPS.has((l.property as Node).name as string)) return 'Zuweisung an technische Eigenschaft';
  }
  // DOM and platform APIs that take selectors, class names, event names, keys or paths.
  for (let i = stack.length - 1; i >= 0; i--) {
    const n = stack[i]!;
    if (n.type === 'CallExpression') {
      const name = calleeName(n);
      if (name && /^(querySelector(All)?|closest|matches|addEventListener|removeEventListener|getAttribute|removeAttribute|hasAttribute|matchMedia|createElement|getItem|setItem|removeItem|glob|fetch|toggle|add|remove|contains|escape|getPropertyValue|setProperty|replace|split|join|padStart|padEnd|startsWith|endsWith|includes|test|exec)$/.test(name)) {
        return `Argument von ${name}()`;
      }
      if (name === 'setAttribute') {
        const [attr] = n.arguments as Node[];
        if (attr === self || !(attr?.type === 'Literal' && TEXT_ATTRS.has(attr.value as string))) return 'Argument von setAttribute()';
      }
      break;
    }
    if (n.type === 'NewExpression') {
      const c = n.callee as Node;
      if (c.type === 'Identifier' && /^(RegExp|URL|Audio|Event|PointerEvent|KeyboardEvent|CustomEvent)$/.test(c.name as string)) return `new ${c.name}()`;
      break;
    }
    if (!/^(TemplateLiteral|ConditionalExpression|LogicalExpression|ArrayExpression|TSAsExpression|TSSatisfiesExpression|BinaryExpression)$/.test(n.type)) break;
  }
  return null;
}

/** True when the literal goes into the DOM as text or a read-aloud attribute. */
function isSink(stack: Node[], self: Node): boolean {
  let child: Node = self;
  for (let i = stack.length - 1; i >= 0; i--) {
    const n = stack[i]!;
    if (n.type === 'CallExpression') {
      const name = calleeName(n);
      const idx = (n.arguments as Node[]).indexOf(child);
      if (name === 'h') return idx >= 2;
      if (name && (TEXT_CALLS.has(name) || TEXT_METHODS.has(name))) return idx >= 0;
      if (name === 'setAttribute') {
        const [attr] = n.arguments as Node[];
        return idx === 1 && attr?.type === 'Literal' && TEXT_ATTRS.has(attr.value as string);
      }
      return false;
    }
    if (n.type === 'Property') {
      // Only attribute objects of h(tag, { … }) are DOM attributes.
      const obj = stack[i - 1];
      const call = stack[i - 2];
      const isAttrs = obj?.type === 'ObjectExpression' && call?.type === 'CallExpression' && calleeName(call) === 'h' && (call.arguments as Node[])[1] === obj;
      const k = n.key as Node;
      const name = (k.type === 'Identifier' ? k.name : k.value) as string;
      return isAttrs && n.value === child && TEXT_ATTRS.has(name);
    }
    if (n.type === 'AssignmentExpression') {
      const l = n.left as Node;
      return n.right === child && l.type === 'MemberExpression' && TEXT_PROPS.has((l.property as Node).name as string);
    }
    // Text passes through these unchanged.
    if (!/^(TemplateLiteral|ConditionalExpression|LogicalExpression|ArrayExpression|BinaryExpression|TSAsExpression|ArrowFunctionExpression|ParenthesizedExpression)$/.test(n.type)) return false;
    child = n;
  }
  return false;
}

function paramsOf(parent: Node | undefined, self: Node): string[] | null {
  if (parent?.type !== 'CallExpression' || calleeName(parent) !== 't' || (parent.arguments as Node[])[0] !== self) return null;
  const obj = (parent.arguments as Node[])[1];
  if (!obj) return [];
  if (obj.type !== 'ObjectExpression') return null;
  return (obj.properties as Node[])
    .map((p) => {
      const k = p.key as Node | undefined;
      return k ? String(k.type === 'Identifier' ? k.name : k.value) : '...';
    })
    .sort();
}

/** All string and template literals in one file, with their context. */
export function literalsIn(file: string): Literal[] {
  const src = readFileSync(file, 'utf8');
  const ast = parseAst(src, { lang: 'ts' }, file) as unknown as Node;
  const out: Literal[] = [];
  const rel = relative(join(SRC, '..'), file);

  const visit = (node: Node, stack: Node[]) => {
    // Types, imports and exports are never text.
    if (/^TS(?!AsExpression|SatisfiesExpression|NonNullExpression)/.test(node.type)) return;
    if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') return;
    const parent = stack[stack.length - 1];
    if (parent && /^(ExportNamedDeclaration|ImportExpression)$/.test(parent.type) && parent.source === node) return;
    const isKey =
      parent &&
      ((parent.type === 'Property' && parent.key === node && !parent.computed) ||
        (parent.type === 'MemberExpression' && parent.property === node && !parent.computed));

    let value: string | null = null;
    if (node.type === 'Literal' && typeof node.value === 'string' && !isKey) value = node.value;
    if (node.type === 'TemplateLiteral' && !(parent?.type === 'TaggedTemplateExpression')) {
      value = (node.quasis as Node[]).map((q) => (q.value as { cooked: string }).cooked).join('{}');
    }
    if (value !== null) {
      const call = [...stack].reverse().find((n) => n.type === 'CallExpression');
      out.push({
        file: rel,
        line: lineOf(src, node.start),
        value,
        sink: isSink(stack, node),
        technical: technicalReason(stack, node),
        callee: parent?.type === 'CallExpression' ? calleeName(parent) : (call ? calleeName(call) : null),
        argIndex: parent?.type === 'CallExpression' ? (parent.arguments as Node[]).indexOf(node) : -1,
        within: stack.flatMap((n) => {
          if (n.type === 'CallExpression') return [calleeName(n) ?? '?'];
          if (n.type === 'NewExpression') return [`new ${((n.callee as Node).name as string) ?? '?'}`];
          if (n.type === 'ThrowStatement') return ['throw'];
          if (n.type === 'ClassDeclaration' && n.superClass) return [`class extends ${((n.superClass as Node).name as string) ?? '?'}`];
          return [];
        }),
        params: paramsOf(parent, node),
        node,
      });
      if (node.type === 'Literal') return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      if (Array.isArray(v)) v.forEach((c) => isNode(c) && visit(c, [...stack, node]));
      else if (isNode(v)) visit(v, [...stack, node]);
    }
  };
  visit(ast, []);
  return out;
}

/** Words or symbols a reader sees: umlauts, a capitalised word, typographic signs. */
const PROSE = /[äöüÄÖÜß]|(^|[^\p{L}\p{N}_$-])\p{Lu}\p{Ll}|[–—→·…„“”‚‘✓✗€§]/u;
const LETTERS = /\p{L}{2,}|[–—→·…„“”‚‘✓✗€§%]/u;

/**
 * Kriterium aus Auftrag 02, Aufgabe 2: Ein Literal gilt als Text, wenn es im DOM
 * landet und Buchstaben oder Satzzeichen trägt, oder wenn es außerhalb eines
 * technischen Kontexts nach Prosa aussieht (Umlaut, großgeschriebenes Wort,
 * typografisches Zeichen).
 */
export function looksLikeText(l: Literal): boolean {
  if (l.sink) return LETTERS.test(l.value);
  if (l.technical) return false;
  return PROSE.test(l.value);
}
