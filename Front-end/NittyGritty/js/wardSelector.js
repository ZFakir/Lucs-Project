/**
 * wardSelector.js
 *
 * Three-level cascading dropdown: Province → Municipality → Ward
 * Reads directly from the wards.csv file hosted on GitHub.
 *
 * Usage: call initWardSelector() once the DOM is ready.
 */

// ---------------------------------------------------------------------------
// Config — URL to actual GitHub repo path
// ---------------------------------------------------------------------------

const CSV_URL =
  './data/wards.csv';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {WardRow[]} */
let allWards = [];

/**
 * @typedef {Object} WardRow
 * @property {string} province
 * @property {string} municipality
 * @property {string} catB
 * @property {string} wardNo
 * @property {string} district
 * @property {string} districtCode
 * @property {string} wardId
 * @property {string} wardLabel
 */

// ---------------------------------------------------------------------------
// CSV loader + parser
// ---------------------------------------------------------------------------

/**
 * Fetches and parses the wards CSV from GitHub.
 * Cached after first load — subsequent calls return immediately.
 * @returns {Promise<WardRow[]>}
 */
async function loadWards() {
  if (allWards.length) return allWards;

  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Could not load wards CSV: ${res.status}`);

  const text = await res.text();

  // Strip UTF-8 BOM if present (common with Excel/GIS exports)
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.split(/\r?\n/).filter(Boolean);

  // Skip header row (index 0)
  allWards = lines.slice(1).map((line) => {
    const c = line.split(',');
    return {
      province:     c[1]?.trim() ?? '',
      municipality: c[2]?.trim() ?? '',
      catB:         c[3]?.trim() ?? '',
      wardNo:       c[4]?.trim() ?? '',
      district:     c[5]?.trim() ?? '',
      districtCode: c[6]?.trim() ?? '',
      wardId:       c[8]?.trim() ?? '',
      wardLabel:    c[9]?.trim() ?? '',
    };
  }).filter((r) => r.wardId); // drop any blank trailing lines

  return allWards;
}

// ---------------------------------------------------------------------------
// Dropdown helpers
// ---------------------------------------------------------------------------

/**
 * Replaces a <select>'s options with a placeholder + new entries.
 * @param {HTMLSelectElement} select
 * @param {Array<{value: string, label: string}>} items
 * @param {string} placeholder
 */
function setOptions(select, items, placeholder) {
  select.innerHTML = '';
  const def = new Option(placeholder, '', true, true);
  def.disabled = true;
  select.appendChild(def);
  items.forEach(({ value, label }) => select.appendChild(new Option(label, value)));
}

/**
 * Resets a <select> to a disabled placeholder and optionally disables it.
 * @param {HTMLSelectElement} select
 * @param {string} placeholder
 * @param {boolean} [disabled=true]
 */
function resetSelect(select, placeholder, disabled = true) {
  select.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
  select.disabled = disabled;
}

// ---------------------------------------------------------------------------
// Main initialiser
// ---------------------------------------------------------------------------

/**
 * Wires up the three cascading dropdowns.
 * Expects these IDs in the DOM:
 *   #province-select, #municipality-select, #ward-select
 *
 * Dispatches a 'ward:selected' CustomEvent on document when a ward is chosen:
 *   event.detail = { wardId, wardNo, wardLabel, municipality, province, catB, district }
 */
export async function initWardSelector() {
  const provinceEl     = document.getElementById('province-select');
  const municipalityEl = document.getElementById('municipality-select');
  const wardEl         = document.getElementById('ward-select');

  if (!provinceEl || !municipalityEl || !wardEl) {
    console.error('[wardSelector] Missing one or more select elements in the DOM.');
    return;
  }

  // Show loading state while CSV fetches
  provinceEl.disabled = true;
  provinceEl.innerHTML = '<option value="" disabled selected>Loading wards…</option>';
  resetSelect(municipalityEl, 'Select a municipality…');
  resetSelect(wardEl,         'Select a ward…');

  let wards;
  try {
    wards = await loadWards();
  } catch (err) {
    console.error('[wardSelector] Failed to load wards:', err);
    provinceEl.innerHTML = '<option value="" disabled selected>Failed to load — check CSV URL</option>';
    return;
  }

  // ── Populate provinces ───────────────────────────────────────────────────
  const provinces = [...new Set(wards.map((w) => w.province))].sort();
  setOptions(
    provinceEl,
    provinces.map((p) => ({ value: p, label: p })),
    'Select a province…'
  );
  provinceEl.disabled = false;

  // ── Province → Municipality ──────────────────────────────────────────────
  provinceEl.addEventListener('change', () => {
    const selectedProvince = provinceEl.value;

    const municipalities = [
      ...new Set(
        wards
          .filter((w) => w.province === selectedProvince)
          .map((w) => w.municipality)
      ),
    ].sort();

    setOptions(
      municipalityEl,
      municipalities.map((m) => ({ value: m, label: m })),
      'Select a municipality…'
    );
    municipalityEl.disabled = false;

    // Reset ward level
    resetSelect(wardEl, 'Select a ward…');
  });

  // ── Municipality → Ward ──────────────────────────────────────────────────
  municipalityEl.addEventListener('change', () => {
    const selectedMunic = municipalityEl.value;

    const municipalityWards = wards
      .filter((w) => w.municipality === selectedMunic)
      .sort((a, b) => Number(a.wardNo) - Number(b.wardNo)); // sort numerically

    setOptions(
      wardEl,
      municipalityWards.map((w) => ({
        value: w.wardId,
        label: `Ward ${w.wardNo}`,
      })),
      'Select a ward…'
    );
    wardEl.disabled = false;
  });

  // ── Ward selected — fire event ────────────────────────────────────────────
  wardEl.addEventListener('change', () => {
    const ward = wards.find((w) => w.wardId === wardEl.value);
    if (!ward) return;

    document.dispatchEvent(
      new CustomEvent('ward:selected', {
        detail: {
          wardId:       ward.wardId,
          wardNo:       ward.wardNo,
          wardLabel:    ward.wardLabel,
          municipality: ward.municipality,
          province:     ward.province,
          catB:         ward.catB,
          district:     ward.district,
          districtCode: ward.districtCode,
        },
      })
    );
  });
}