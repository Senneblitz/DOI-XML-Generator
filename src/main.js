// Entry point for the browser UI.

import { start } from './ui/app.js';

start().catch((e) => {
  document.body.prepend(
    Object.assign(document.createElement('p'), { className: 'fatal', textContent: `Start fehlgeschlagen: ${e.message}` }),
  );
  throw e;
});
