import '@fontsource/courier-prime/latin-400.css';
import '@fontsource/courier-prime/latin-700.css';
import './ui/style.css';
import { ContentError } from './core/loader';
import { startApp } from './ui/app';
import { loadBundledContent } from './ui/content';
import { errorView } from './ui/views';

const root = document.getElementById('app')!;
try {
  startApp(root, loadBundledContent());
} catch (e) {
  const msg = e instanceof ContentError ? e.message : String(e);
  console.error(e);
  root.replaceChildren(errorView(msg));
}
