// Phase 2 feasibility spike: can the browser call ROR and ORCID directly (CORS)?
// Throwaway code; results are summarised in docs/spike.md.

const RUNS = 3;

const ROR = 'https://api.ror.org/v2/organizations';
const ORCID = 'https://pub.orcid.org/v3.0';

// Structured ORCID query; values with spaces are quoted.
const orcidQ = (family, given) => {
  const term = (v) => (/\s/.test(v) ? `"${v}"` : v);
  return [family && `family-name:${term(family)}`, given && `given-names:${term(given)}`].filter(Boolean).join(' AND ');
};

const CASES = [
  { api: 'ROR', label: 'query=DZHW', url: `${ROR}?query=DZHW` },
  { api: 'ROR', label: 'query=Hochschulforschung', url: `${ROR}?query=Hochschulforschung` },
  { api: 'ROR', label: 'query=German Center for Integration', url: `${ROR}?query=${encodeURIComponent('German Center for Integration')}` },
  { api: 'ROR', label: 'query=Leibniz Hannover', url: `${ROR}?query=${encodeURIComponent('Leibniz Hannover')}` },
  { api: 'ROR', label: 'query=uni (3 Zeichen)', url: `${ROR}?query=uni` },
  { api: 'ROR', label: 'query=Hochschulf (Präfix, keine Treffer erwartet)', url: `${ROR}?query=Hochschulf` },
  { api: 'ROR', label: 'query.advanced=Deutsches AND Zentrum AND Hochsch*', url: `${ROR}?query.advanced=${encodeURIComponent('Deutsches AND Zentrum AND Hochsch*')}` },
  { api: 'ROR', label: 'Fehlerfall: 400 (unbekannter Parameter)', url: `${ROR}?foo=bar` },
  // Neutral search examples: Josiah Carberry is ORCID's fictional demonstration person, the other
  // queries are common names whose hit count alone is of interest. No colleague is named here.
  { api: 'ORCID', label: 'Carberry / Josiah', url: `${ORCID}/expanded-search/?rows=10&q=${encodeURIComponent(orcidQ('Carberry', 'Josiah'))}` },
  { api: 'ORCID', label: 'Müller / Anna (Umlaut)', url: `${ORCID}/expanded-search/?rows=10&q=${encodeURIComponent(orcidQ('Müller', 'Anna'))}` },
  { api: 'ORCID', label: 'de Vries / Anna (Leerzeichen)', url: `${ORCID}/expanded-search/?rows=10&q=${encodeURIComponent(orcidQ('de Vries', 'Anna'))}` },
  { api: 'ORCID', label: 'Smith / John (häufiger Name)', url: `${ORCID}/expanded-search/?rows=10&q=${encodeURIComponent(orcidQ('Smith', 'John'))}` },
  { api: 'ORCID', label: 'Müller (nur Familienname)', url: `${ORCID}/expanded-search/?rows=10&q=${encodeURIComponent(orcidQ('Müller'))}` },
  { api: 'ORCID', label: 'Carb* / Josiah (Präfix)', url: `${ORCID}/expanded-search/?rows=10&q=${encodeURIComponent('family-name:Carb* AND given-names:Josiah')}` },
  { api: 'ORCID', label: 'iD 0000-0002-1825-0097 /person (Demo-Datensatz)', url: `${ORCID}/0000-0002-1825-0097/person` },
  { api: 'ORCID', label: 'Fehlerfall: 500 (Syntaxfehler in q)', url: `${ORCID}/expanded-search/?q=${encodeURIComponent('family-name:(')}` },
  { api: 'ORCID', label: 'Fehlerfall: 404 (unbekannte iD)', url: `${ORCID}/0000-0000-0000-0000/person` },
];

const summarize = {
  ROR: (j) => ({
    hits: j.number_of_results,
    first: j.items?.[0] && `${j.items[0].names.find((n) => n.types.includes('ror_display'))?.value} <${j.items[0].id}>`,
  }),
  ORCID: (j) =>
    j['expanded-result'] !== undefined
      ? {
          hits: j['num-found'],
          first: j['expanded-result']?.[0] &&
            `${j['expanded-result'][0]['family-names']}, ${j['expanded-result'][0]['given-names']} <${j['expanded-result'][0]['orcid-id']}> ${j['expanded-result'][0]['institution-name'].slice(0, 2).join('; ')}`,
        }
      : { hits: '–', first: `${j.name?.['family-name']?.value}, ${j.name?.['given-names']?.value}` },
};

async function probe(c) {
  const times = [];
  let res, body, error;
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    try {
      res = await fetch(c.url, { headers: { Accept: 'application/json' } });
      body = await res.json();
    } catch (e) {
      error = `${e.name}: ${e.message}`;
      break;
    }
    times.push(Math.round(performance.now() - t0));
  }
  const headers = res && !error ? [...res.headers].map(([k, v]) => `${k}: ${v}`) : [];
  return { ...c, status: error ?? res.status, times, headers, body, error };
}

const td = (text, cls = '') => {
  const el = document.createElement('td');
  el.textContent = text ?? '';
  if (cls) el.className = cls;
  return el;
};

export async function runAll() {
  const out = document.getElementById('out');
  const samples = document.getElementById('samples');
  out.replaceChildren();
  samples.replaceChildren();
  const results = [];
  for (const c of CASES) {
    const r = await probe(c);
    results.push(r);
    const s = r.error || !String(r.status).startsWith('2') ? {} : summarize[c.api](r.body);
    const tr = document.createElement('tr');
    tr.append(
      td(c.api),
      td(c.label),
      td(String(r.status), r.error ? 'err' : 'ok'),
      td(r.times.join(' / '), 'num'),
      td(String(s.hits ?? ''), 'num'),
      td(s.first),
      td(r.headers.join('\n')),
    );
    out.append(tr);
    if (!r.error && !samples.querySelector(`[data-api="${c.api}"]`)) {
      const pre = document.createElement('pre');
      pre.dataset.api = c.api;
      pre.textContent = `${c.api} – ${c.label}\n${JSON.stringify(r.body, null, 1).slice(0, 3000)}`;
      samples.append(pre);
    }
  }
  // Exposed for inspection from devtools / automation.
  window.spikeResults = results.map(({ body, ...r }) => ({
    ...r,
    ...(r.error || !String(r.status).startsWith('2') ? {} : summarize[r.api](body)),
  }));
  return window.spikeResults;
}

document.getElementById('run').addEventListener('click', async () => {
  const state = document.getElementById('state');
  state.textContent = ' läuft …';
  await runAll();
  state.textContent = ' fertig.';
});
