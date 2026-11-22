import '@fontsource/courier-prime/latin-400.css';
import '@fontsource/courier-prime/latin-700.css';
import '@fontsource/old-standard-tt/latin-400.css';
import '@fontsource/old-standard-tt/latin-700.css';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-600.css';
import '@fontsource/eb-garamond/latin-700.css';
import './ui/style.css';
import { ContentError } from './core/loader';
import { startApp } from './ui/app';
import { loadBundledContent, loadBundledTexts } from './ui/content';
import { UiTextError } from './ui/text';
import { errorView } from './ui/views';

const root = document.getElementById('app')!;
try {
  loadBundledTexts();
  startApp(root, loadBundledContent());
} catch (e) {
  const msg = e instanceof ContentError || e instanceof UiTextError ? e.message : String(e);
  console.error(e);
  root.replaceChildren(errorView(msg));
}
