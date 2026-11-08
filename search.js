// search.js -- fuzzy logo search. Loaded after app.js; replaces its filterLogos().
//
// What it does differently from the old search:
//  - case- and accent-insensitive ("Ø", "å", "É" match "o", "a", "e")
//  - matches anywhere in the name, not only at the start of a word ("graphic" finds "National Geographic")
//  - ignores spaces/hyphens when comparing ("tv2" finds "TV 2", "sfkanalen" finds "SF Kanalen")
//  - tolerates small typos ("nattional", "discovry")
//  - small alias table for common short names (extend ALIASES below)
//  - ranks results: exact word > word prefix > substring > fuzzy
(function () {
  // Add your own: left side is what people type (normalised), right side is what to search for instead.
  const ALIASES = {
    'natgeo': 'national geographic',
    'nat geo': 'national geographic',
    'cnn int': 'cnn international',
    'bbc 1': 'bbc one',
    'bbc 2': 'bbc two',
    'bbc 3': 'bbc three',
    'bbc 4': 'bbc four',
  };

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(IMAGE_EXT_RE, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  // Levenshtein distance, giving up early once it exceeds `max`.
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function indexLogo(logo) {
    if (logo._k !== undefined) return;
    logo._k = norm(logo.name);
    logo._t = logo._k.split(' ').filter(Boolean);
    logo._c = logo._t.join('');
  }

  // Score one query word against one logo. 0 = no match.
  function scoreWord(w, logo) {
    if (logo._t.includes(w)) return 100;
    if (logo._t.some(t => t.startsWith(w))) return 85;
    if (w.length >= 2 && logo._c.includes(w)) return 65;
    if (w.length >= 4) {
      const max = w.length >= 8 ? 2 : 1;
      for (const t of logo._t) {
        if (lev(w, t, max) <= max) return 45;
        if (t.length > w.length && lev(w, t.slice(0, w.length), max) <= max) return 40; // typo in a prefix
      }
    }
    return 0;
  }

  function searchScore(query, words, logo) {
    indexLogo(logo);
    let total = 0;
    for (const w of words) {
      const s = scoreWord(w, logo);
      if (!s) return 0;
      total += s;
    }
    let score = total / words.length;
    if (logo._k.startsWith(query)) score += 15;      // whole query is the start of the name
    if (logo._k === query) score += 30;              // exact name
    score -= logo._k.length * 0.05;                  // prefer shorter, more specific names
    return Math.max(score, 1);
  }

  window.filterLogos = function filterLogos() {
    let query = norm(el.searchBox.value);
    if (ALIASES[query]) query = ALIASES[query];
    const words = query.split(' ').filter(Boolean);
    const countryFilter = countryCombo.getValue();

    const inCountry = logo => {
      if (!countryFilter) return true;
      const c = logo.country || '';
      return countryFilter.includes('/') ? c === countryFilter : c.split('/')[0] === countryFilter;
    };

    let filtered;
    if (!words.length) {
      filtered = allLogos.filter(inCountry);
    } else {
      filtered = [];
      for (const logo of allLogos) {
        if (!inCountry(logo)) continue;
        const s = searchScore(query, words, logo);
        if (s > 0) filtered.push({ logo, s });
      }
      filtered.sort((a, b) => b.s - a.s || a.logo.name.localeCompare(b.logo.name));
      filtered = filtered.map(x => x.logo);
    }

    displayLogos(filtered);
    updateStats(filtered.length);
  };
})();
