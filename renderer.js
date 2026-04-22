// renderer.js — v7

let allPeople = [];
let allFamilies = [];
let selectedPersonId = null;
let currentTreeId = null;
let currentView = 'pedigree';

function getEl(id) { return document.getElementById(id); }

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function fullName(person) {
  if (!person) return '';
  var parts = [];
  if (person.title) parts.push(person.title);
  parts.push(person.name || '');
  if (person.suffix) parts.push(person.suffix);
  return parts.join(' ').trim();
}

// ═══════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing...');
  initTheme();
  setupHeaderButtons();
  setupViewTabs();
  loadHomeScreen();
});

// ═══════════════════════════════════════════════════════════════════
// DARK MODE
// ═══════════════════════════════════════════════════════════════════

function initTheme() {
  var saved = localStorage.getItem('family-tree-theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark-mode');
    document.documentElement.classList.remove('light-mode');
  } else if (saved === 'light') {
    document.documentElement.classList.add('light-mode');
    document.documentElement.classList.remove('dark-mode');
  }
  // If no saved preference, system preference applies via CSS @media
  updateThemeIcons();
  setupThemeToggles();
}

function isDarkMode() {
  if (document.documentElement.classList.contains('dark-mode')) return true;
  if (document.documentElement.classList.contains('light-mode')) return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function toggleTheme() {
  var currentlyDark = isDarkMode();
  if (currentlyDark) {
    document.documentElement.classList.remove('dark-mode');
    document.documentElement.classList.add('light-mode');
    localStorage.setItem('family-tree-theme', 'light');
  } else {
    document.documentElement.classList.add('dark-mode');
    document.documentElement.classList.remove('light-mode');
    localStorage.setItem('family-tree-theme', 'dark');
  }
  updateThemeIcons();
}

function updateThemeIcons() {
  var dark = isDarkMode();
  var icon = dark ? 'light_mode' : 'dark_mode';
  document.querySelectorAll('.theme-toggle .material-symbols-outlined').forEach(function(el) {
    el.textContent = icon;
  });
}

function setupThemeToggles() {
  document.querySelectorAll('.theme-toggle').forEach(function(btn) {
    btn.addEventListener('click', toggleTheme);
  });
}

function setupHeaderButtons() {
  const backBtn = getEl('backToHomeBtn');
  const importBtn = getEl('importBtn');
  const exportBtn = getEl('exportBtn');
  const printBtn = getEl('printBtn');
  const reportBtn = getEl('reportBtn');

  if (backBtn) backBtn.addEventListener('click', () => loadHomeScreen());

  if (importBtn) importBtn.addEventListener('click', async () => {
    if (!currentTreeId) return;
    importBtn.textContent = 'Importing...';
    try {
      const r = await window.api.importGedcom(currentTreeId);
      if (!r.canceled) { await refreshData(); alert('Imported ' + r.individuals + ' individuals and ' + r.families + ' families.'); }
    } catch (err) { console.error(err); alert('Import failed.'); }
    importBtn.innerHTML = '<span class="material-symbols-outlined">download</span> Import GEDCOM';
  });

  if (exportBtn) exportBtn.addEventListener('click', async () => {
    if (!currentTreeId) return;
    try {
      const fp = await window.api.exportGedcom(currentTreeId);
      if (fp) alert('Exported to:\n' + fp);
    } catch (err) { console.error(err); alert('Export failed.'); }
  });

  if (printBtn) printBtn.addEventListener('click', async () => {
    try {
      const fp = await window.api.printToPdf();
      if (fp) alert('PDF saved to:\n' + fp);
    } catch (err) { console.error(err); alert('PDF failed.'); }
  });

  if (reportBtn) reportBtn.addEventListener('click', async () => {
    if (!currentTreeId) return;
    reportBtn.textContent = 'Generating...';
    try {
      var html = await generateFamilyReport();
      var fp = await window.api.saveReport(html);
      if (fp) alert('Report saved to:\n' + fp);
    } catch (err) { console.error(err); alert('Report generation failed.'); }
    reportBtn.innerHTML = '<span class="material-symbols-outlined">summarize</span> Family Report';
  });
}

function setupViewTabs() {
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentView = tab.dataset.view;
      document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderTree();
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════════════

async function loadHomeScreen() {
  console.log('Loading home screen...');
  getEl('homeScreen').classList.remove('hidden');
  getEl('treeScreen').classList.add('hidden');
  currentTreeId = null;

  let trees = [];
  try {
    trees = await window.api.getTrees();
    console.log('Trees loaded:', trees.length);
  } catch (err) {
    console.error('Failed to load trees:', err);
  }

  const list = getEl('treeList');
  let html = '';

  for (const t of trees) {
    html += '<div class="tree-card" data-tree-id="' + t.id + '">'
      + '<div class="tree-card-actions">'
      + '<button data-edit-tree="' + t.id + '" title="Edit"><span class="material-symbols-outlined" style="font-size:16px">edit</span></button>'
      + '<button data-delete-tree="' + t.id + '" title="Delete"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button>'
      + '</div>'
      + '<div class="tree-card-name">' + esc(t.name) + '</div>'
      + '<div class="tree-card-desc">' + esc(t.description || '') + '</div>'
      + '<div class="tree-card-meta">'
      + '<span class="material-symbols-outlined" style="font-size:14px">person</span> '
      + t.personCount + (t.personCount === 1 ? ' person' : ' people')
      + '</div>'
      + '</div>';
  }

  html += '<div class="new-tree-card" id="newTreeCard">'
    + '<span class="material-symbols-outlined">add_circle</span>'
    + '<span>New Family Tree</span>'
    + '</div>';

  html += '<div class="new-tree-card" id="importTreeCard" style="border-color:var(--primary)">'
    + '<span class="material-symbols-outlined" style="color:var(--primary)">download</span>'
    + '<span style="color:var(--primary)">Import GEDCOM as New Tree</span>'
    + '</div>';

  // Deleted trees section
  var deletedTrees = [];
  try { deletedTrees = await window.api.getDeletedTrees(); } catch (e) {}

  if (deletedTrees.length > 0) {
    html += '</div>'; // close tree-grid temporarily
    html += '<div style="margin-top:40px">'
      + '<div style="font-family:var(--font-headline);font-weight:700;font-size:16px;color:var(--secondary);margin-bottom:12px;display:flex;align-items:center;gap:8px">'
      + '<span class="material-symbols-outlined" style="font-size:20px">delete</span> Recently Deleted'
      + '</div>'
      + '<div class="tree-grid">';
    deletedTrees.forEach(function(t) {
      var deletedDate = t.deleted_at ? new Date(t.deleted_at + 'Z').toLocaleDateString() : '';
      html += '<div class="tree-card" style="opacity:0.6;border-style:dashed" data-deleted-tree-id="' + t.id + '">'
        + '<div class="tree-card-name">' + esc(t.name) + '</div>'
        + '<div class="tree-card-desc" style="color:var(--danger)">Deleted ' + deletedDate + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:12px">'
        + '<button class="sidebar-btn secondary" style="padding:8px 12px;font-size:12px;margin:0;flex:1" data-restore-tree="' + t.id + '">'
        + '<span class="material-symbols-outlined" style="font-size:14px">restore</span> Restore</button>'
        + '<button class="sidebar-btn danger" style="padding:8px 12px;font-size:12px;margin:0;flex:1" data-perm-delete-tree="' + t.id + '">'
        + '<span class="material-symbols-outlined" style="font-size:14px">delete_forever</span> Delete Forever</button>'
        + '</div></div>';
    });
    html += '</div></div><div class="tree-grid" style="display:none">'; // reopen tree-grid so closing tag works
  }

  list.innerHTML = html;

  // Bind: open tree
  list.querySelectorAll('.tree-card[data-tree-id]').forEach(card => {
    card.addEventListener('click', function(e) {
      if (e.target.closest('[data-edit-tree]') || e.target.closest('[data-delete-tree]')) return;
      openTree(parseInt(this.dataset.treeId));
    });
  });

  // Bind: edit tree
  list.querySelectorAll('[data-edit-tree]').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const tid = parseInt(this.dataset.editTree);
      const t = trees.find(function(x) { return x.id === tid; });
      if (t) showTreeModal(t);
    });
  });

  // Bind: delete tree
  list.querySelectorAll('[data-delete-tree]').forEach(btn => {
    btn.addEventListener('click', async function(e) {
      e.stopPropagation();
      const tid = parseInt(this.dataset.deleteTree);
      const t = trees.find(function(x) { return x.id === tid; });
      if (t && confirm('Delete "' + t.name + '" and all its data? This cannot be undone.')) {
        await window.api.deleteTree(t.id);
        loadHomeScreen();
      }
    });
  });

  // Bind: restore deleted tree
  document.querySelectorAll('[data-restore-tree]').forEach(function(btn) {
    btn.addEventListener('click', async function(e) {
      e.stopPropagation();
      var tid = parseInt(this.dataset.restoreTree);
      await window.api.restoreTree(tid);
      loadHomeScreen();
    });
  });

  // Bind: permanently delete tree
  document.querySelectorAll('[data-perm-delete-tree]').forEach(function(btn) {
    btn.addEventListener('click', async function(e) {
      e.stopPropagation();
      var tid = parseInt(this.dataset.permDeleteTree);
      if (confirm('Permanently delete this tree? This cannot be undone.')) {
        await window.api.permanentlyDeleteTree(tid);
        loadHomeScreen();
      }
    });
  });

  // Bind: new tree
  var newCard = getEl('newTreeCard');
  if (newCard) {
    console.log('New tree card found, binding click...');
    newCard.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('New tree card clicked');
      showTreeModal(null);
    });
  } else {
    console.error('newTreeCard element not found!');
  }

  // Bind: import as new tree
  var importCard = getEl('importTreeCard');
  if (importCard) {
    importCard.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      showImportTreeModal();
    });
  }
}

function showTreeModal(existing) {
  console.log('showTreeModal called, existing:', existing);

  // Remove any existing modals
  var old = document.querySelector('.modal-overlay');
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  var modal = document.createElement('div');
  modal.className = 'modal';

  var title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = existing ? 'Edit Family Tree' : 'New Family Tree';
  modal.appendChild(title);

  var nameGroup = document.createElement('div');
  nameGroup.className = 'form-group';
  var nameLabel = document.createElement('label');
  nameLabel.className = 'form-label';
  nameLabel.textContent = 'Name';
  var nameInput = document.createElement('input');
  nameInput.className = 'form-input';
  nameInput.type = 'text';
  nameInput.value = existing ? existing.name : '';
  nameInput.placeholder = 'e.g. Diallo Family';
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  modal.appendChild(nameGroup);

  var descGroup = document.createElement('div');
  descGroup.className = 'form-group';
  var descLabel = document.createElement('label');
  descLabel.className = 'form-label';
  descLabel.textContent = 'Description (optional)';
  var descInput = document.createElement('input');
  descInput.className = 'form-input';
  descInput.type = 'text';
  descInput.value = existing ? (existing.description || '') : '';
  descInput.placeholder = 'e.g. Maternal line from Senegal';
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descInput);
  modal.appendChild(descGroup);

  var actions = document.createElement('div');
  actions.className = 'modal-actions';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'modal-btn cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.type = 'button';

  var confirmBtn = document.createElement('button');
  confirmBtn.className = 'modal-btn confirm';
  confirmBtn.textContent = existing ? 'Save' : 'Create';
  confirmBtn.type = 'button';

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  modal.appendChild(actions);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  cancelBtn.addEventListener('click', function() {
    overlay.remove();
  });

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  confirmBtn.addEventListener('click', async function() {
    var name = nameInput.value.trim();
    if (!name) { alert('Name is required.'); return; }
    var desc = descInput.value.trim();

    try {
      if (existing) {
        await window.api.updateTree(existing.id, name, desc);
      } else {
        await window.api.createTree(name, desc);
      }
      overlay.remove();
      loadHomeScreen();
    } catch (err) {
      console.error('Failed to save tree:', err);
      alert('Failed to save. Check console.');
    }
  });

  nameInput.focus();
}

function showImportTreeModal() {
  var old = document.querySelector('.modal-overlay');
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  var modal = document.createElement('div');
  modal.className = 'modal';

  var title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = 'Import GEDCOM as New Tree';
  modal.appendChild(title);

  var nameGroup = document.createElement('div');
  nameGroup.className = 'form-group';
  var nameLabel = document.createElement('label');
  nameLabel.className = 'form-label';
  nameLabel.textContent = 'Name for this family tree (optional — auto-detected from file)';
  var nameInput = document.createElement('input');
  nameInput.className = 'form-input';
  nameInput.type = 'text';
  nameInput.value = '';
  nameInput.placeholder = 'Leave blank to auto-name from surnames';
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  modal.appendChild(nameGroup);

  var actions = document.createElement('div');
  actions.className = 'modal-actions';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'modal-btn cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.type = 'button';

  var confirmBtn = document.createElement('button');
  confirmBtn.className = 'modal-btn confirm';
  confirmBtn.textContent = 'Choose File & Import';
  confirmBtn.type = 'button';

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  modal.appendChild(actions);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  cancelBtn.addEventListener('click', function() { overlay.remove(); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

  confirmBtn.addEventListener('click', async function() {
    var name = nameInput.value.trim();
    if (!name) name = 'Imported Family';

    try {
      var newTree = await window.api.createTree(name, 'Imported from GEDCOM');
      var result = await window.api.importGedcom(newTree.id);
      if (result.canceled) {
        await window.api.permanentlyDeleteTree(newTree.id);
        overlay.remove();
        return;
      }
      overlay.remove();

      // Build a summary with family surnames
      var people = await window.api.getPeople(newTree.id);
      var surnames = {};
      people.forEach(function(p) {
        var parts = p.name.trim().split(/\s+/);
        if (parts.length > 1) {
          var surname = parts[parts.length - 1];
          surnames[surname] = (surnames[surname] || 0) + 1;
        }
      });
      var surnameList = Object.keys(surnames).sort(function(a, b) { return surnames[b] - surnames[a]; });
      var familyNames = surnameList.length > 0 ? '\nFamilies: ' + surnameList.join(', ') : '';

      // If user left default name, rename to most common surname
      if (name === 'Imported Family' && surnameList.length > 0) {
        var autoName = surnameList[0] + ' Family';
        if (surnameList.length > 1) autoName = surnameList.slice(0, 2).join(' & ') + ' Family';
        await window.api.updateTree(newTree.id, autoName, 'Imported from GEDCOM');
      }

      alert('Imported ' + result.individuals + ' people and ' + result.families + ' families.' + familyNames);
      openTree(newTree.id);
    } catch (err) {
      console.error('Import as new tree failed:', err);
      alert('Import failed. Check console.');
    }
  });

  nameInput.focus();
  nameInput.select();
}

// ═══════════════════════════════════════════════════════════════════
// TREE VIEW
// ═══════════════════════════════════════════════════════════════════

async function openTree(treeId) {
  console.log('Opening tree:', treeId);
  currentTreeId = treeId;
  getEl('homeScreen').classList.add('hidden');
  getEl('treeScreen').classList.remove('hidden');

  var trees = await window.api.getTrees();
  var tree = trees.find(function(t) { return t.id === treeId; });
  getEl('treeTitle').textContent = tree ? tree.name : 'Family Tree';

  await refreshData();
}

// ─── Data Layer ──────────────────────────────────────────────────────

async function refreshData() {
  allPeople = await window.api.getPeople(currentTreeId);
  allFamilies = await window.api.getFamilies(currentTreeId);
  console.log('Loaded', allPeople.length, 'people,', allFamilies.length, 'families');

  if (!selectedPersonId || !allPeople.find(function(p) { return p.id === selectedPersonId; })) {
    selectedPersonId = allPeople.length > 0 ? allPeople[0].id : null;
  }
  renderTree();
  renderSidebar();
}

// ─── Lookup Helpers ──────────────────────────────────────────────────

function personById(id) { return allPeople.find(function(p) { return p.id === id; }); }

function getParentsOf(person) {
  var fam = allFamilies.find(function(f) { return (f.childIds || []).indexOf(person.id) !== -1; });
  if (!fam) return [];
  var out = [];
  if (fam.husband_id) { var p = personById(fam.husband_id); if (p) out.push(p); }
  if (fam.wife_id) { var p = personById(fam.wife_id); if (p) out.push(p); }
  return out;
}

function getParentFamilyOf(person) {
  return allFamilies.find(function(f) { return (f.childIds || []).indexOf(person.id) !== -1; }) || null;
}

function getChildrenOf(person) {
  var fams = allFamilies.filter(function(f) { return f.husband_id === person.id || f.wife_id === person.id; });
  var kids = [];
  fams.forEach(function(f) {
    (f.childIds || []).forEach(function(cid) {
      var c = personById(cid);
      if (c && !kids.find(function(k) { return k.id === c.id; })) kids.push(c);
    });
  });
  // Sort children by birth date
  kids.sort(function(a, b) {
    var da = a.birth_date || '';
    var db = b.birth_date || '';
    var ya = da.match(/(\d{4})/);
    var yb = db.match(/(\d{4})/);
    if (ya && yb) return parseInt(ya[1]) - parseInt(yb[1]);
    if (ya) return -1;
    if (yb) return 1;
    return 0;
  });
  return kids;
}

function getSpousesOf(person) {
  var fams = allFamilies.filter(function(f) { return f.husband_id === person.id || f.wife_id === person.id; });
  var out = [];
  fams.forEach(function(f) {
    var sid = f.husband_id === person.id ? f.wife_id : f.husband_id;
    if (sid) { var s = personById(sid); if (s && !out.find(function(x) { return x.id === s.id; })) out.push(s); }
  });
  return out;
}

function getSiblingsOf(person) {
  var fam = allFamilies.find(function(f) { return (f.childIds || []).indexOf(person.id) !== -1; });
  if (!fam) return [];
  var siblings = (fam.childIds || []).filter(function(cid) { return cid !== person.id; })
    .map(function(cid) { return personById(cid); }).filter(Boolean);
  // Sort by birth date
  siblings.sort(function(a, b) {
    var da = a.birth_date || '';
    var db = b.birth_date || '';
    var ya = da.match(/(\d{4})/);
    var yb = db.match(/(\d{4})/);
    if (ya && yb) return parseInt(ya[1]) - parseInt(yb[1]);
    if (ya) return -1;
    if (yb) return 1;
    return 0;
  });
  return siblings;
}

function getSpouseFamilies(person) {
  return allFamilies.filter(function(f) { return f.husband_id === person.id || f.wife_id === person.id; });
}

// ─── Display Helpers ─────────────────────────────────────────────────

function photoHtml(p, cls) {
  if (p.photo_path) return '<img src="file://' + p.photo_path + '" class="' + (cls || 'person-photo') + '" alt="" />';
  return '<div class="' + (cls || 'person-photo-placeholder') + '"><span class="material-symbols-outlined">person</span></div>';
}

function lifeSpan(p) {
  var parts = [];
  if (p.birth_date) {
    var bd = (typeof parseGenealogyDate === 'function') ? parseGenealogyDate(p.birth_date).display : p.birth_date;
    parts.push(bd || p.birth_date);
  }
  if (p.death_date) {
    var dd = (typeof parseGenealogyDate === 'function') ? parseGenealogyDate(p.death_date).display : p.death_date;
    parts.push('d. ' + (dd || p.death_date));
  }
  if (p.sex) parts.push(p.sex);
  return parts.join(' &middot; ');
}

function badges(p) {
  var b = '';
  if (p.is_adopted) b += '<span class="badge badge-adopted">Adopted</span>';
  if (p.death_date) b += '<span class="badge badge-deceased">Deceased</span>';
  return b;
}

// ─── Card Components ─────────────────────────────────────────────────

function personCard(person, label, borderClass) {
  var sel = person.id === selectedPersonId ? 'selected' : '';
  return '<div class="person-card ' + borderClass + ' ' + sel + '" data-person-id="' + person.id + '">'
    + '<div class="person-card-header">'
    + photoHtml(person)
    + '<div style="min-width:0">'
    + '<div class="person-card-label">' + label + '</div>'
    + '<div class="person-card-name">' + esc(fullName(person)) + '</div>'
    + '</div></div>'
    + '<div class="person-card-meta">' + lifeSpan(person) + '</div>'
    + '<div style="margin-top:3px">' + badges(person) + '</div>'
    + '</div>';
}

function selectedCard(person) {
  return '<div class="selected-card" data-person-id="' + person.id + '">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    + '<span class="selected-badge">Selected</span>'
    + '<span class="material-symbols-outlined" style="color:var(--primary);font-size:18px">verified</span>'
    + '</div>'
    + '<div class="person-card-header">'
    + photoHtml(person)
    + '<div class="person-card-name" style="font-size:18px">' + esc(fullName(person)) + '</div>'
    + '</div>'
    + '<div class="person-card-meta" style="color:var(--primary);font-weight:600">' + lifeSpan(person) + '</div>'
    + '<div style="margin-top:4px">' + badges(person) + '</div>'
    + (person.country ? '<div class="person-card-meta" style="margin-top:4px">' + esc([person.address, person.country].filter(Boolean).join(', ')) + '</div>' : '')
    + '</div>';
}

// ─── Render Tree Dispatcher ──────────────────────────────────────────

function renderTree() {
  var tc = getEl('treeContainer');
  if (!tc) return;

  if (allPeople.length === 0) {
    tc.innerHTML = '<div class="empty-state">'
      + '<span class="material-symbols-outlined">account_tree</span>'
      + '<div class="title">No family data yet</div>'
      + '<p>Import a GEDCOM file or add a person to get started.</p>'
      + '</div>';
    return;
  }

  if (currentView === 'pedigree') renderPedigree(tc);
  else if (currentView === 'descendants') renderDescendants(tc);
  else if (currentView === 'family-group') renderFamilyGroup(tc);
  else if (currentView === 'map') { renderMapView(tc); return; }
  else if (currentView === 'statistics') { renderStatistics(tc); return; }

  // Add print header (hidden on screen, shown when printing)
  var treeName = getEl('treeTitle') ? getEl('treeTitle').textContent : 'Family Tree';
  var printHeader = '<div class="print-header"><h1>' + esc(treeName) + '</h1><p>Printed on ' + new Date().toLocaleDateString() + '</p></div>';

  // Add navigation bar
  var navBar = '<div class="tree-nav-bar">';

  // Back to first person button
  if (allPeople.length > 0 && selectedPersonId !== allPeople[0].id) {
    navBar += '<button class="tree-nav-btn" id="navFirstPerson" title="Go to first person">'
      + '<span class="material-symbols-outlined" style="font-size:16px">home</span> '
      + esc(allPeople[0].name) + '</button>';
  }

  // History breadcrumb: show selected person's parents for quick back-navigation
  var selPerson = personById(selectedPersonId);
  if (selPerson) {
    var breadcrumbParents = getParentsOf(selPerson);
    if (breadcrumbParents.length > 0) {
      navBar += '<span class="tree-nav-sep">&larr;</span>';
      breadcrumbParents.forEach(function(bp) {
        navBar += '<button class="tree-nav-btn" data-nav-person="' + bp.id + '">'
          + esc(bp.name) + '</button>';
      });
    }
    navBar += '<span class="tree-nav-current">' + esc(selPerson.name) + '</span>';
  }

  navBar += '</div>';

  tc.innerHTML = printHeader + navBar + tc.innerHTML;

  // Bind nav buttons
  var firstBtn = getEl('navFirstPerson');
  if (firstBtn) {
    firstBtn.addEventListener('click', function() {
      selectedPersonId = allPeople[0].id;
      renderTree();
      renderSidebar();
    });
  }
  tc.querySelectorAll('[data-nav-person]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      selectedPersonId = parseInt(this.dataset.navPerson);
      renderTree();
      renderSidebar();
    });
  });

  tc.querySelectorAll('[data-person-id]').forEach(function(el) {
    el.addEventListener('click', function() {
      selectedPersonId = parseInt(this.dataset.personId);
      renderTree();
      renderSidebar();
    });
  });
}

// ─── Pedigree View ───────────────────────────────────────────────────

function renderPedigree(tc) {
  var sel = personById(selectedPersonId);
  if (!sel) return;
  var parents = getParentsOf(sel);
  var children = getChildrenOf(sel);
  var siblings = getSiblingsOf(sel);
  var spouses = getSpousesOf(sel);
  var spFams = getSpouseFamilies(sel);

  var gpMap = {};
  parents.forEach(function(p) { gpMap[p.id] = getParentsOf(p); });

  var h = '<div class="pedigree-row">';

  // Grandparents
  var allGP = [];
  parents.forEach(function(p) { allGP = allGP.concat(gpMap[p.id] || []); });
  if (allGP.length) {
    h += '<div class="pedigree-col">';
    allGP.forEach(function(x) { h += personCard(x, 'Grandparent', 'border-muted'); });
    h += '</div><div class="ribbon-h"></div>';
  }

  // Parents
  if (parents.length) {
    h += '<div class="pedigree-col">';
    parents.forEach(function(x) { h += personCard(x, 'Parent', 'border-secondary'); });
    h += '</div><div class="ribbon-h"></div>';
  }

  // Selected + Spouses + Siblings
  h += '<div class="pedigree-col">';
  h += selectedCard(sel);
  spouses.forEach(function(sp) {
    var fam = spFams.find(function(f) { return f.husband_id === sp.id || f.wife_id === sp.id; });
    var divBadge = (fam && fam.status === 'divorced') ? ' <span class="badge badge-divorced">Divorced</span>' : '';
    var mDate = (fam && fam.marriage_date) ? ' <span style="font-size:10px;color:var(--secondary)">m. ' + esc(parseGenealogyDate(fam.marriage_date).display) + '</span>' : '';
    h += personCard(sp, 'Spouse' + divBadge + mDate, 'border-tertiary');
  });
  if (siblings.length) {
    h += '<div class="section-divider"><div class="section-label">Siblings</div>';
    siblings.forEach(function(s) { h += personCard(s, 'Sibling', 'border-muted'); });
    h += '</div>';
  }
  h += '</div>';

  // Children
  if (children.length) {
    h += '<div class="ribbon-h"></div><div class="pedigree-col">';
    children.forEach(function(c) {
      var label = c.is_adopted ? 'Child (Adopted)' : 'Child';
      var childSpouses = getSpousesOf(c);
      var spouseInfo = '';
      if (childSpouses.length > 0) {
        spouseInfo = childSpouses.map(function(cs) {
          var csFams = getSpouseFamilies(c);
          var csFam = csFams.find(function(f) { return f.husband_id === cs.id || f.wife_id === cs.id; });
          var csDiv = (csFam && csFam.status === 'divorced') ? ' <span class="badge badge-divorced">div.</span>' : '';
          return esc(cs.name) + csDiv;
        }).join(', ');
        spouseInfo = '<div style="font-size:11px;color:var(--secondary);margin-top:2px">m. ' + spouseInfo + '</div>';
      }
      h += '<div class="person-card border-muted ' + (c.id === selectedPersonId ? 'selected' : '') + '" data-person-id="' + c.id + '">'
        + '<div class="person-card-header">'
        + photoHtml(c)
        + '<div style="min-width:0">'
        + '<div class="person-card-label">' + label + '</div>'
        + '<div class="person-card-name">' + esc(c.name) + '</div>'
        + '</div></div>'
        + '<div class="person-card-meta">' + lifeSpan(c) + '</div>'
        + spouseInfo
        + '<div style="margin-top:3px">' + badges(c) + '</div>'
        + '</div>';

      // Show child's spouse as a small linked card
      childSpouses.forEach(function(cs) {
        h += '<div class="person-card border-tertiary" style="width:220px;margin-left:20px;opacity:0.85" data-person-id="' + cs.id + '">'
          + '<div class="person-card-header">'
          + photoHtml(cs)
          + '<div style="min-width:0">'
          + '<div class="person-card-label">Spouse of ' + esc(c.name.split(' ')[0]) + '</div>'
          + '<div class="person-card-name">' + esc(cs.name) + '</div>'
          + '</div></div>'
          + '<div class="person-card-meta">' + lifeSpan(cs) + '</div>'
          + '</div>';
      });
    });
    h += '</div>';
  }

  h += '</div>';
  tc.innerHTML = h;
}

// ─── Descendants View ────────────────────────────────────────────────

function renderDescendants(tc) {
  var root = personById(selectedPersonId);
  if (!root) return;
  tc.innerHTML = '<div style="width:100%">'
    + '<div style="font-family:var(--font-headline);font-weight:700;font-size:18px;margin-bottom:20px">Descendants of ' + esc(root.name) + '</div>'
    + buildDescBranch(root, 0)
    + '</div>';
}

function buildDescBranch(person, depth) {
  var kids = getChildrenOf(person);
  var spouses = getSpousesOf(person);
  var depthClass = depth === 0 ? 'depth-0' : depth === 1 ? 'depth-1' : '';

  var spTxt = '';
  if (spouses.length) {
    var labels = spouses.map(function(sp) {
      var fams = getSpouseFamilies(person);
      var f = fams.find(function(f) { return f.husband_id === sp.id || f.wife_id === sp.id; });
      var d = (f && f.status === 'divorced') ? ' <span class="badge badge-divorced">div.</span>' : '';
      return '<span data-person-id="' + sp.id + '" style="cursor:pointer;color:var(--tertiary)">' + esc(sp.name) + '</span>' + d;
    });
    spTxt = '<span style="font-size:12px;color:var(--secondary);margin-left:8px">m. ' + labels.join(', ') + '</span>';
  }

  var h = '<div class="desc-branch" style="margin-left:' + (depth * 32) + 'px">'
    + (depth > 0 ? '<div class="desc-connector"></div>' : '')
    + '<div class="desc-card ' + depthClass + (person.id === selectedPersonId ? ' selected' : '') + '" data-person-id="' + person.id + '">'
    + photoHtml(person)
    + '<div>'
    + '<div style="font-family:var(--font-headline);font-weight:700;font-size:13px">' + esc(person.name) + spTxt + '</div>'
    + '<div style="font-size:11px;color:var(--tertiary)">' + lifeSpan(person) + '</div>'
    + '<div>' + badges(person) + '</div>'
    + '</div></div></div>';

  kids.forEach(function(c) { h += buildDescBranch(c, depth + 1); });
  return h;
}

// ─── Family Group Sheet ──────────────────────────────────────────────

function renderFamilyGroup(tc) {
  var sel = personById(selectedPersonId);
  if (!sel) return;
  var spFams = getSpouseFamilies(sel);
  var parentFam = getParentFamilyOf(sel);

  var h = '<div style="width:100%;max-width:800px">'
    + '<div style="font-family:var(--font-headline);font-weight:700;font-size:18px;margin-bottom:20px">Family Group Sheet &mdash; ' + esc(sel.name) + '</div>';

  if (parentFam) {
    var fa = parentFam.husband_id ? personById(parentFam.husband_id) : null;
    var mo = parentFam.wife_id ? personById(parentFam.wife_id) : null;
    h += '<div class="fg-section"><div class="fg-section-header">Parents</div>'
      + '<table class="fg-table"><thead><tr><th>Role</th><th>Name</th><th>Birth</th><th>Death</th><th>Location</th></tr></thead><tbody>'
      + (fa ? fgRow('Father', fa) : '') + (mo ? fgRow('Mother', mo) : '')
      + '</tbody></table></div>';
  }

  if (!spFams.length) {
    h += '<div class="fg-section"><div class="fg-section-header">Individual</div>'
      + '<table class="fg-table"><thead><tr><th>Role</th><th>Name</th><th>Birth</th><th>Death</th><th>Location</th></tr></thead><tbody>'
      + fgRow('Self', sel) + '</tbody></table></div>';
  }

  spFams.forEach(function(fam) {
    var spId = fam.husband_id === sel.id ? fam.wife_id : fam.husband_id;
    var sp = spId ? personById(spId) : null;
    var status = fam.status === 'divorced' ? ' (Divorced)' : '';
    var kids = (fam.childIds || []).map(function(cid) { return personById(cid); }).filter(Boolean);
    var mDateDisplay = fam.marriage_date ? parseGenealogyDate(fam.marriage_date).display : '';
    var mPlace = fam.marriage_place || '';
    var marriageInfo = '';
    if (mDateDisplay || mPlace) {
      marriageInfo = ' &mdash; Married' + (mDateDisplay ? ' ' + esc(mDateDisplay) : '') + (mPlace ? ', ' + esc(mPlace) : '');
    }

    h += '<div class="fg-section"><div class="fg-section-header">Family' + status + (sp ? ' &mdash; with ' + esc(sp.name) : '') + marriageInfo + '</div>'
      + '<table class="fg-table"><thead><tr><th>Role</th><th>Name</th><th>Birth</th><th>Death</th><th>Location</th></tr></thead><tbody>'
      + (sel.sex === 'M' ? fgRow('Husband', sel) : fgRow('Wife', sel))
      + (sp ? (sp.sex === 'M' ? fgRow('Husband', sp) : fgRow('Wife', sp)) : '');
    kids.forEach(function(k, i) {
      h += fgRow('Child ' + (i + 1) + (k.is_adopted ? ' (Adopted)' : ''), k);
    });
    h += '</tbody></table></div>';
  });

  h += '</div>';
  tc.innerHTML = h;
}

function fgRow(role, p) {
  var loc = [p.address, p.country].filter(Boolean).join(', ') || '&mdash;';
  var occ = p.occupation ? '<div style="font-size:11px;color:var(--secondary)">' + esc(p.occupation) + '</div>' : '';
  return '<tr><td data-person-id="' + p.id + '" style="font-weight:600;color:var(--secondary);cursor:pointer">' + role + '</td>'
    + '<td data-person-id="' + p.id + '" style="cursor:pointer"><div class="fg-name-cell">' + photoHtml(p) + '<div><span style="font-family:var(--font-headline);font-weight:600">' + esc(fullName(p)) + '</span>' + occ + '</div></div></td>'
    + '<td>' + (p.birth_date || '&mdash;') + '</td><td>' + (p.death_date || '&mdash;') + '</td><td>' + loc + '</td></tr>';
}

// ─── Map View ────────────────────────────────────────────────────

function renderMapView(tc) {
  // Group people by resolved country
  var countryGroups = {};
  allPeople.forEach(function(p) {
    var resolved = resolveCountry(p.country) || resolveCountry(p.address);
    if (resolved) {
      var key = resolved.name;
      if (!countryGroups[key]) countryGroups[key] = { country: resolved, people: [] };
      countryGroups[key].people.push(p);
    }
  });

  var countries = Object.keys(countryGroups);

  if (countries.length === 0) {
    tc.innerHTML = '<div class="empty-state">'
      + '<span class="material-symbols-outlined">map</span>'
      + '<div class="title">No locations to show</div>'
      + '<p>Add country or address information to people to see them on the map.</p>'
      + '</div>';
    return;
  }

  // Try Leaflet (requires internet for tiles), fall back to built-in SVG
  if (typeof L !== 'undefined') {
    renderLeafletMap(tc, countryGroups, countries);
  } else {
    renderSvgMapFallback(tc, countryGroups, countries);
  }
}

// ─── Leaflet Map (online) ────────────────────────────────────────

var leafletMap = null; // hold reference to destroy on re-render

function renderLeafletMap(tc, countryGroups, countries) {
  tc.innerHTML = '<div style="width:100%">'
    + '<div style="font-family:var(--font-headline);font-weight:700;font-size:18px;margin-bottom:16px">Family Map</div>'
    + '<div class="map-container">'
    + '<div id="leafletMapWrap" style="flex:1;min-width:0"></div>'
    + '<div class="map-sidebar" id="mapSidebar"></div>'
    + '</div></div>';

  // Build legend sidebar
  buildMapLegend(countryGroups, countries);

  // Create Leaflet map container
  var mapDiv = document.createElement('div');
  mapDiv.id = 'leafletMap';
  mapDiv.className = 'leaflet-map-container';
  getEl('leafletMapWrap').appendChild(mapDiv);

  // Destroy previous map instance if exists
  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
  }

  // Compute bounds from family locations
  var bounds = [];
  countries.forEach(function(key) {
    var g = countryGroups[key];
    bounds.push([g.country.lat, g.country.lng]);
  });

  // Create map
  leafletMap = L.map('leafletMap', {
    zoomControl: true,
    attributionControl: true
  });

  // Add tile layer — CartoDB Voyager (free, no API key, works well with Electron)
  // Falls back to OSM if CartoDB fails
  var tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 12,
    minZoom: 2
  });

  var tileErrorCount = 0;
  tileLayer.on('tileerror', function() {
    tileErrorCount++;
    // If many tiles fail, we're probably offline — switch to SVG fallback
    if (tileErrorCount > 4) {
      if (leafletMap) {
        leafletMap.remove();
        leafletMap = null;
      }
      var tc2 = getEl('treeContainer');
      if (tc2) renderSvgMapFallback(tc2, countryGroups, countries);
    }
  });

  tileLayer.addTo(leafletMap);

  // Fit to family locations with padding
  if (bounds.length === 1) {
    leafletMap.setView(bounds[0], 5);
  } else {
    leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
  }

  // Custom marker icon using a simple circle div
  function createMarkerIcon(count) {
    var size = Math.min(28 + count * 4, 48);
    return L.divIcon({
      className: 'leaflet-family-pin',
      html: '<div style="'
        + 'width:' + size + 'px;height:' + size + 'px;'
        + 'background:#0051d5;color:white;border-radius:50%;'
        + 'display:flex;align-items:center;justify-content:center;'
        + 'font-family:Inter,sans-serif;font-weight:700;font-size:' + Math.max(11, size * 0.35) + 'px;'
        + 'border:3px solid white;box-shadow:0 2px 8px rgba(0,81,213,0.35);'
        + 'cursor:pointer'
        + '">' + count + '</div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)]
    });
  }

  // Add markers for each country
  countries.forEach(function(key) {
    var group = countryGroups[key];
    var marker = L.marker([group.country.lat, group.country.lng], {
      icon: createMarkerIcon(group.people.length)
    }).addTo(leafletMap);

    // Build popup content
    var popupHtml = '<div style="min-width:180px">'
      + '<div style="font-family:var(--font-headline);font-weight:700;font-size:15px;color:#0051d5;margin-bottom:8px">'
      + esc(key) + '</div>';

    group.people.forEach(function(p) {
      popupHtml += '<div class="map-popup-name" data-popup-person="' + p.id + '">' + esc(fullName(p)) + '</div>'
        + '<div class="map-popup-meta">' + lifeSpan(p) + '</div>';
    });
    popupHtml += '</div>';

    marker.bindPopup(popupHtml, { maxWidth: 280 });

    // When popup opens, bind person clicks
    marker.on('popupopen', function() {
      document.querySelectorAll('[data-popup-person]').forEach(function(el) {
        el.addEventListener('click', function() {
          selectedPersonId = parseInt(this.dataset.popupPerson);
          currentView = 'pedigree';
          document.querySelectorAll('.view-tab').forEach(function(t) { t.classList.remove('active'); });
          document.querySelector('[data-view="pedigree"]').classList.add('active');
          renderTree();
          renderSidebar();
        });
      });
    });

    // Also update legend detail on click
    marker.on('click', function() {
      showMapCountryDetail(group);
    });
  });
}

// ─── SVG Map Fallback (offline) ──────────────────────────────────

function renderSvgMapFallback(tc, countryGroups, countries) {
  tc.innerHTML = '<div style="width:100%">'
    + '<div style="font-family:var(--font-headline);font-weight:700;font-size:18px;margin-bottom:16px">Family Map</div>'
    + '<div class="map-offline-badge"><span class="material-symbols-outlined" style="font-size:14px">wifi_off</span> Offline mode &mdash; showing simplified map</div>'
    + '<div class="map-container">'
    + '<div class="map-svg-wrap" id="mapSvgWrap"></div>'
    + '<div class="map-sidebar" id="mapSidebar"></div>'
    + '</div></div>';

  // Build legend sidebar
  buildMapLegend(countryGroups, countries);

  // Generate SVG map using built-in world-map.js
  var svgW = 960;
  var svgH = 480;
  var svgContent = generateWorldMapSVG(svgW, svgH);

  var wrap = getEl('mapSvgWrap');
  wrap.innerHTML = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" xmlns="http://www.w3.org/2000/svg" '
    + 'style="width:100%;height:auto;max-width:960px;border-radius:12px">'
    + svgContent + '</svg>';

  var svgEl = wrap.querySelector('svg');
  if (svgEl) {
    var familyCountryNames = {};
    countries.forEach(function(key) { familyCountryNames[key] = true; });

    // Highlight country paths
    svgEl.querySelectorAll('path[data-country-name]').forEach(function(pathEl) {
      var pathName = pathEl.getAttribute('data-country-name');
      if (familyCountryNames[pathName]) {
        pathEl.style.fill = '#93b4f5';
        pathEl.style.stroke = '#0051d5';
        pathEl.style.strokeWidth = '1';
        pathEl.style.cursor = 'pointer';
        pathEl.style.transition = 'fill 0.2s';
        pathEl.dataset.mapCountry = pathName;
      }
    });

    // Pin projection matching world-map.js equirectangular
    function pinX(lng) { return ((lng + 180) / 360) * svgW; }
    function pinY(lat) { return ((90 - lat) / 180) * svgH; }

    var pinGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pinGroup.setAttribute('class', 'pin-overlay');

    countries.forEach(function(key) {
      var group = countryGroups[key];
      var cx = pinX(group.country.lng);
      var cy = pinY(group.country.lat);
      var count = group.people.length;
      var r = Math.min(8 + count * 2, 18);

      var shadow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      shadow.setAttribute('cx', cx);
      shadow.setAttribute('cy', cy + 2);
      shadow.setAttribute('r', r);
      shadow.setAttribute('fill', 'rgba(0,0,0,0.15)');
      pinGroup.appendChild(shadow);

      var pin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pin.setAttribute('cx', cx);
      pin.setAttribute('cy', cy);
      pin.setAttribute('r', r);
      pin.setAttribute('fill', '#0051d5');
      pin.setAttribute('stroke', 'white');
      pin.setAttribute('stroke-width', '2');
      pin.style.cursor = 'pointer';
      pin.dataset.mapCountry = key;
      pinGroup.appendChild(pin);

      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', cx);
      text.setAttribute('y', cy + 1);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', 'white');
      text.setAttribute('font-size', Math.max(8, r * 0.7));
      text.setAttribute('font-weight', '700');
      text.setAttribute('font-family', 'Inter, sans-serif');
      text.style.pointerEvents = 'none';
      text.textContent = count;
      pinGroup.appendChild(text);

      var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', cx);
      label.setAttribute('y', cy + r + 10);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#191c1e');
      label.setAttribute('font-size', '8');
      label.setAttribute('font-weight', '600');
      label.setAttribute('font-family', 'Inter, sans-serif');
      label.style.pointerEvents = 'none';
      label.textContent = key;
      pinGroup.appendChild(label);
    });

    svgEl.appendChild(pinGroup);

    svgEl.querySelectorAll('[data-map-country]').forEach(function(el) {
      el.addEventListener('click', function() {
        var name = this.dataset.mapCountry;
        if (countryGroups[name]) showMapCountryDetail(countryGroups[name]);
      });
    });
  }
}

// ─── Shared Map Helpers ──────────────────────────────────────────

function buildMapLegend(countryGroups, countries) {
  var legendHtml = '<div class="map-legend">';
  legendHtml += '<div class="map-legend-title">Family Origins</div>';
  countries.sort(function(a, b) { return countryGroups[b].people.length - countryGroups[a].people.length; });
  countries.forEach(function(key) {
    var group = countryGroups[key];
    legendHtml += '<div class="map-legend-item" data-map-legend="' + esc(key) + '">'
      + '<div class="map-legend-dot"></div>'
      + '<div class="map-legend-text">'
      + '<div class="map-legend-country">' + esc(key) + '</div>'
      + '<div class="map-legend-count">' + group.people.length + ' ' + (group.people.length === 1 ? 'person' : 'people') + '</div>'
      + '</div></div>';
  });
  legendHtml += '</div><div id="mapDetail" class="map-detail"></div>';
  getEl('mapSidebar').innerHTML = legendHtml;

  document.querySelectorAll('[data-map-legend]').forEach(function(el) {
    el.addEventListener('click', function() {
      showMapCountryDetail(countryGroups[this.dataset.mapLegend]);
    });
  });
}

// ─── Statistics Dashboard ─────────────────────────────────────────

function renderStatistics(tc) {
  if (allPeople.length === 0) {
    tc.innerHTML = '<div class="empty-state">'
      + '<span class="material-symbols-outlined">bar_chart</span>'
      + '<div class="title">No data yet</div>'
      + '<p>Add people to your tree to see statistics.</p>'
      + '</div>';
    return;
  }

  // Compute statistics
  var totalPeople = allPeople.length;
  var males = allPeople.filter(function(p) { return p.sex === 'M'; }).length;
  var females = allPeople.filter(function(p) { return p.sex === 'F'; }).length;
  var unknownSex = totalPeople - males - females;
  var deceased = allPeople.filter(function(p) { return p.death_date; }).length;
  var living = totalPeople - deceased;
  var adopted = allPeople.filter(function(p) { return p.is_adopted; }).length;
  var withPhotos = allPeople.filter(function(p) { return p.photo_path; }).length;
  var totalFamilies = allFamilies.length;

  // Birth year extraction
  var birthYears = [];
  allPeople.forEach(function(p) {
    if (p.birth_date) {
      var m = p.birth_date.match(/(\d{4})/);
      if (m) birthYears.push(parseInt(m[1]));
    }
  });
  birthYears.sort(function(a, b) { return a - b; });
  var earliestYear = birthYears.length > 0 ? birthYears[0] : null;
  var latestYear = birthYears.length > 0 ? birthYears[birthYears.length - 1] : null;
  var yearSpan = (earliestYear && latestYear) ? (latestYear - earliestYear) : 0;

  // Estimate generations (rough: ~25-30 years per generation)
  var estGenerations = yearSpan > 0 ? Math.ceil(yearSpan / 28) : 1;

  // Surname analysis
  var surnames = {};
  allPeople.forEach(function(p) {
    var parts = (p.name || '').trim().split(/\s+/);
    if (parts.length > 1) {
      var surname = parts[parts.length - 1];
      surnames[surname] = (surnames[surname] || 0) + 1;
    }
  });
  var surnameList = Object.keys(surnames).sort(function(a, b) { return surnames[b] - surnames[a]; });

  // Country analysis
  var countryCount = {};
  allPeople.forEach(function(p) {
    var resolved = resolveCountry(p.country) || resolveCountry(p.address);
    if (resolved) countryCount[resolved.name] = (countryCount[resolved.name] || 0) + 1;
  });
  var countryList = Object.keys(countryCount).sort(function(a, b) { return countryCount[b] - countryCount[a]; });

  // Average children per family
  var familiesWithKids = allFamilies.filter(function(f) { return (f.childIds || []).length > 0; });
  var totalChildren = 0;
  familiesWithKids.forEach(function(f) { totalChildren += (f.childIds || []).length; });
  var avgChildren = familiesWithKids.length > 0 ? (totalChildren / familiesWithKids.length).toFixed(1) : '0';

  // Birth decade histogram
  var decades = {};
  birthYears.forEach(function(y) {
    var dec = Math.floor(y / 10) * 10;
    decades[dec] = (decades[dec] || 0) + 1;
  });
  var decadeKeys = Object.keys(decades).sort();
  var maxDecadeCount = 0;
  decadeKeys.forEach(function(d) { if (decades[d] > maxDecadeCount) maxDecadeCount = decades[d]; });

  // Occupation analysis
  var occupations = {};
  allPeople.forEach(function(p) {
    if (p.occupation) {
      var occ = p.occupation.trim();
      occupations[occ] = (occupations[occ] || 0) + 1;
    }
  });
  var occList = Object.keys(occupations).sort(function(a, b) { return occupations[b] - occupations[a]; });

  // Build HTML
  var h = '<div style="width:100%;max-width:960px">';
  h += '<div style="font-family:var(--font-headline);font-weight:700;font-size:18px;margin-bottom:20px">Statistics Dashboard</div>';

  // Summary cards
  h += '<div class="stats-grid">';
  h += statCard('group', 'blue', totalPeople, 'Total People');
  h += statCard('family_restroom', 'purple', totalFamilies, 'Families');
  h += statCard('favorite', 'rose', living, 'Living');
  h += statCard('schedule', 'amber', (earliestYear && latestYear) ? earliestYear + ' – ' + latestYear : '—', 'Year Range');
  h += statCard('stacks', 'teal', estGenerations, 'Est. Generations');
  h += statCard('child_care', 'green', avgChildren, 'Avg Children / Family');
  h += '</div>';

  // Gender breakdown
  h += '<div class="stats-section">';
  h += '<div class="stats-section-title"><span class="material-symbols-outlined">wc</span> Gender</div>';
  if (males > 0) h += statsBar('Male', males, totalPeople, '');
  if (females > 0) h += statsBar('Female', females, totalPeople, 'purple');
  if (unknownSex > 0) h += statsBar('Unknown', unknownSex, totalPeople, 'amber');
  h += '</div>';

  // Living vs Deceased
  h += '<div class="stats-section">';
  h += '<div class="stats-section-title"><span class="material-symbols-outlined">monitoring</span> Status</div>';
  h += statsBar('Living', living, totalPeople, 'green');
  h += statsBar('Deceased', deceased, totalPeople, 'rose');
  if (adopted > 0) h += statsBar('Adopted', adopted, totalPeople, 'amber');
  if (withPhotos > 0) h += statsBar('With Photos', withPhotos, totalPeople, 'teal');
  h += '</div>';

  // Surnames
  if (surnameList.length > 0) {
    h += '<div class="stats-section">';
    h += '<div class="stats-section-title"><span class="material-symbols-outlined">badge</span> Surnames</div>';
    surnameList.slice(0, 10).forEach(function(name) {
      h += statsBar(name, surnames[name], totalPeople, 'purple');
    });
    h += '</div>';
  }

  // Countries
  if (countryList.length > 0) {
    h += '<div class="stats-section">';
    h += '<div class="stats-section-title"><span class="material-symbols-outlined">public</span> Countries</div>';
    countryList.slice(0, 10).forEach(function(name) {
      h += statsBar(name, countryCount[name], totalPeople, 'teal');
    });
    h += '</div>';
  }

  // Occupations
  if (occList.length > 0) {
    h += '<div class="stats-section">';
    h += '<div class="stats-section-title"><span class="material-symbols-outlined">work</span> Occupations</div>';
    occList.slice(0, 10).forEach(function(name) {
      h += statsBar(name, occupations[name], totalPeople, 'amber');
    });
    h += '</div>';
  }

  // Birth decade timeline
  if (decadeKeys.length > 0) {
    h += '<div class="stats-section">';
    h += '<div class="stats-section-title"><span class="material-symbols-outlined">timeline</span> Births by Decade</div>';
    h += '<div class="stats-timeline">';
    decadeKeys.forEach(function(dec) {
      var pct = maxDecadeCount > 0 ? (decades[dec] / maxDecadeCount * 100) : 0;
      h += '<div class="stats-timeline-bar" style="height:' + Math.max(pct, 5) + '%" title="' + dec + 's: ' + decades[dec] + ' born"></div>';
    });
    h += '</div>';
    h += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--secondary);margin-top:4px;padding:0 4px">';
    h += '<span>' + decadeKeys[0] + 's</span>';
    h += '<span>' + decadeKeys[decadeKeys.length - 1] + 's</span>';
    h += '</div>';
    h += '</div>';
  }

  h += '</div>';
  tc.innerHTML = h;
}

function statCard(icon, colorClass, value, label) {
  return '<div class="stat-card">'
    + '<div class="stat-card-icon ' + colorClass + '"><span class="material-symbols-outlined">' + icon + '</span></div>'
    + '<div class="stat-card-value">' + value + '</div>'
    + '<div class="stat-card-label">' + label + '</div>'
    + '</div>';
}

function statsBar(label, count, total, colorClass) {
  var pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return '<div class="stats-bar-row">'
    + '<div class="stats-bar-label">' + esc(label) + '</div>'
    + '<div class="stats-bar-track"><div class="stats-bar-fill ' + colorClass + '" style="width:' + pct + '%"></div></div>'
    + '<div class="stats-bar-count">' + count + '</div>'
    + '</div>';
}

function showMapCountryDetail(group) {
  var detail = getEl('mapDetail');
  if (!detail || !group) return;

  var h = '<div class="map-detail-header">'
    + '<span class="material-symbols-outlined" style="color:var(--primary)">location_on</span> '
    + '<strong>' + esc(group.country.name) + '</strong>'
    + '</div>';

  group.people.forEach(function(p) {
    h += '<div class="map-person-item" data-person-id="' + p.id + '">'
      + photoHtml(p)
      + '<div style="min-width:0">'
      + '<div style="font-family:var(--font-headline);font-weight:700;font-size:13px">' + esc(p.name) + '</div>'
      + '<div style="font-size:11px;color:var(--secondary)">' + lifeSpan(p) + '</div>'
      + '</div></div>';
  });

  detail.innerHTML = h;

  // Bind person clicks — navigate to them in pedigree
  detail.querySelectorAll('[data-person-id]').forEach(function(el) {
    el.addEventListener('click', function() {
      selectedPersonId = parseInt(this.dataset.personId);
      currentView = 'pedigree';
      document.querySelectorAll('.view-tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelector('[data-view="pedigree"]').classList.add('active');
      renderTree();
      renderSidebar();
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════

function renderSidebar() {
  var sb = getEl('sidebar');
  if (!sb) return;
  var person = personById(selectedPersonId);

  if (!person) {
    sb.innerHTML = '<div class="sidebar-name">No selection</div>'
      + '<div class="sidebar-subtitle">Import data or add a person.</div>'
      + '<button class="sidebar-btn primary" id="addPersonBtn"><span class="material-symbols-outlined">person_add</span> Add Person</button>';
    var btn = getEl('addPersonBtn');
    if (btn) btn.addEventListener('click', function() { showAddPersonForm(); });
    return;
  }

  var children = getChildrenOf(person);
  var spouses = getSpousesOf(person);
  var siblings = getSiblingsOf(person);
  var spFams = getSpouseFamilies(person);

  var sidebarPhoto = person.photo_path
    ? '<img src="file://' + person.photo_path + '" class="sidebar-photo" alt="" />'
    : '<div class="sidebar-photo-placeholder"><span class="material-symbols-outlined">person</span></div>';

  var spouseHtml = '';
  spouses.forEach(function(sp) {
    var fam = spFams.find(function(f) { return f.husband_id === sp.id || f.wife_id === sp.id; });
    var isDivorced = fam && fam.status === 'divorced';
    var mDate = fam && fam.marriage_date ? parseGenealogyDate(fam.marriage_date).display : '';
    var mPlace = fam && fam.marriage_place ? fam.marriage_place : '';
    spouseHtml += '<div class="marriage-detail">'
      + '<div class="marriage-detail-row">'
      + '<span class="spouse-name">' + esc(sp.name) + '</span>'
      + '<button class="status-toggle ' + (isDivorced ? 'divorced' : 'married') + '" data-toggle-divorce="' + (fam ? fam.id : '') + '">'
      + (isDivorced ? 'Divorced' : 'Married')
      + '</button></div>'
      + (mDate ? '<div style="font-size:11px;color:var(--secondary)">Married: ' + esc(mDate) + '</div>' : '')
      + (mPlace ? '<div style="font-size:11px;color:var(--tertiary)">' + esc(mPlace) + '</div>' : '')
      + '<button class="marriage-edit-link" data-edit-marriage="' + (fam ? fam.id : '') + '">Edit marriage details</button>'
      + '</div>';
  });

  sb.innerHTML = sidebarPhoto
    + '<div class="sidebar-name">' + esc(fullName(person)) + '</div>'
    + '<div class="sidebar-subtitle">Manage individual records</div>'
    + metaField('Sex', person.sex || '—')
    + metaField('Birth Date', person.birth_date || '—')
    + (person.death_date ? metaField('Death Date', person.death_date) : '')
    + (person.cause_of_death ? metaField('Cause of Death', person.cause_of_death) : '')
    + (person.is_adopted ? metaField('Status', 'Adopted') : '')
    + (person.occupation ? metaField('Occupation', person.occupation) : '')
    + (person.religion ? metaField('Religion', person.religion) : '')
    + (person.address ? metaField('Address', person.address) : '')
    + (person.country ? metaField('Country', person.country) : '')
    + (person.burial_location ? metaField('Burial Location', person.burial_location) : '')
    + (person.notes ? '<div class="meta-field"><div class="meta-label">Notes</div><div class="meta-value" style="font-size:13px;font-weight:400;white-space:pre-wrap">' + esc(person.notes) + '</div></div>' : '')
    + (spouseHtml ? '<div style="margin-bottom:10px"><div class="meta-label" style="margin-bottom:6px">Spouse(s)</div>' + spouseHtml + '</div>' : '')
    + (children.length ? metaField('Children', children.map(function(c) { return esc(c.name) + (c.is_adopted ? ' (adopted)' : ''); }).join(', ')) : '')
    + (siblings.length ? metaField('Siblings', siblings.map(function(s) { return esc(s.name); }).join(', ')) : '')
    + '<div style="margin-top:auto;padding-top:16px">'
    + '<button class="sidebar-btn ghost" id="photoBtn"><span class="material-symbols-outlined">add_a_photo</span> ' + (person.photo_path ? 'Change Photo' : 'Add Photo') + '</button>'
    + (person.photo_path ? '<button class="sidebar-btn ghost" id="removePhotoBtn" style="color:var(--danger)"><span class="material-symbols-outlined">no_photography</span> Remove Photo</button>' : '')
    + '<button class="sidebar-btn primary" id="addRelativeBtn"><span class="material-symbols-outlined">add_circle</span> Add Relative</button>'
    + '<button class="sidebar-btn secondary" id="editProfileBtn"><span class="material-symbols-outlined">edit</span> Edit Profile</button>'
    + '<button class="sidebar-btn danger" id="deletePersonBtn"><span class="material-symbols-outlined">delete</span> Delete Person</button>'
    + '<button class="sidebar-btn ghost" id="trashBtn" style="margin-top:8px"><span class="material-symbols-outlined">restore_from_trash</span> Recently Deleted</button>'
    + '<button class="sidebar-btn ghost" id="relCalcBtn" style="margin-top:0"><span class="material-symbols-outlined">group</span> Find Relationship</button>'
    + '</div>';

  getEl('photoBtn').addEventListener('click', async function() {
    var p = await window.api.pickPhoto(person.id);
    if (p) await refreshData();
  });
  var removePhotoBtn = getEl('removePhotoBtn');
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', async function() {
      if (confirm('Remove the photo for ' + person.name + '?')) {
        await window.api.updatePerson(person.id, { photoPath: null });
        await refreshData();
      }
    });
  }
  getEl('addRelativeBtn').addEventListener('click', function() { showAddRelativeForm(person); });
  getEl('editProfileBtn').addEventListener('click', function() { showEditForm(person); });
  getEl('deletePersonBtn').addEventListener('click', function() { deletePerson(person); });
  getEl('trashBtn').addEventListener('click', function() { showTrashView(); });
  getEl('relCalcBtn').addEventListener('click', function() { showRelationshipCalc(person); });

  // Marriage edit links
  document.querySelectorAll('[data-edit-marriage]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var famId = parseInt(this.dataset.editMarriage);
      if (famId) showEditMarriageForm(famId, person);
    });
  });

  document.querySelectorAll('[data-toggle-divorce]').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var famId = parseInt(this.dataset.toggleDivorce);
      if (!famId) return;
      var fam = allFamilies.find(function(f) { return f.id === famId; });
      await window.api.updateFamily(famId, { status: (fam && fam.status === 'divorced') ? 'married' : 'divorced' });
      await refreshData();
    });
  });
}

function metaField(label, value) {
  return '<div class="meta-field"><div class="meta-label">' + label + '</div><div class="meta-value">' + esc(String(value)) + '</div></div>';
}

// ─── Add Relative ────────────────────────────────────────────────────

function showAddRelativeForm(person) {
  var sb = getEl('sidebar');
  var existingFams = allFamilies.filter(function(f) { return f.husband_id || f.wife_id; });
  var famOpts = '<option value="">— Create new family —</option>';
  existingFams.forEach(function(f) {
    var hName = f.husband_id ? personById(f.husband_id) : null;
    var wName = f.wife_id ? personById(f.wife_id) : null;
    var label = [hName ? hName.name : null, wName ? wName.name : null].filter(Boolean).join(' & ') || 'Unknown';
    famOpts += '<option value="' + f.id + '">' + esc(label) + '</option>';
  });
  var parentFam = getParentFamilyOf(person);

  sb.innerHTML = '<button class="back-link" id="backBtn"><span class="material-symbols-outlined" style="font-size:16px">arrow_back</span> Back</button>'
    + '<div class="sidebar-name" style="font-size:18px">Add Relative</div>'
    + '<div class="sidebar-subtitle">For <strong>' + esc(person.name) + '</strong></div>'
    + '<div class="form-group"><label class="form-label">Relationship</label>'
    + '<select id="relType" class="form-select"><option value="child">Child</option><option value="spouse">Spouse</option><option value="parent">Parent</option><option value="sibling">Sibling</option></select></div>'
    + '<div class="form-group hidden" id="sibRow"><label class="form-label">Parent Family</label>'
    + '<select id="sibFam" class="form-select">' + famOpts + '</select></div>'
    + '<div class="form-group"><label class="form-label">Full Name</label>'
    + '<input id="relName" class="form-input" placeholder="e.g. Maria Doe"/></div>'
    + '<div class="form-group"><label class="form-label">Sex</label>'
    + '<select id="relSex" class="form-select"><option value="F">Female</option><option value="M">Male</option><option value="">Unknown</option></select></div>'
    + '<div class="form-group"><label class="form-label">Birth Date</label>'
    + '<input id="relBirth" class="form-input" placeholder="e.g. 15 MAR 1990"/></div>'
    + '<label class="form-checkbox-row hidden" id="adoptedRow"><input type="checkbox" id="relAdopted" class="form-checkbox"/> <span class="form-label" style="margin:0">Adopted</span></label>'
    + '<button class="sidebar-btn primary" id="saveRelBtn"><span class="material-symbols-outlined">save</span> Save Relative</button>';

  var relType = getEl('relType');
  var sibRow = getEl('sibRow');
  var adoptedRow = getEl('adoptedRow');
  var sibFam = getEl('sibFam');

  function updateVis() {
    var v = relType.value;
    sibRow.classList.toggle('hidden', v !== 'sibling');
    adoptedRow.classList.toggle('hidden', v !== 'child' && v !== 'sibling');
  }
  relType.addEventListener('change', updateVis);
  updateVis();
  if (parentFam && sibFam) sibFam.value = parentFam.id;

  getEl('backBtn').addEventListener('click', function() { renderSidebar(); });

  getEl('saveRelBtn').addEventListener('click', async function() {
    var type = relType.value;
    var name = getEl('relName').value.trim();
    var sex = getEl('relSex').value;
    var birth = getEl('relBirth').value.trim();
    var adoptedEl = getEl('relAdopted');
    var adopted = adoptedEl ? adoptedEl.checked : false;
    if (!name) { alert('Name is required.'); return; }

    var np = await window.api.addPerson(currentTreeId, { name: name, sex: sex, birthDate: birth || null, isAdopted: (type === 'child' || type === 'sibling') ? adopted : false });

    if (type === 'child') {
      var fam = allFamilies.find(function(f) { return f.husband_id === person.id || f.wife_id === person.id; });
      if (fam) { await window.api.updateFamily(fam.id, { addChildId: np.id }); }
      else {
        var fd = { childIds: [np.id], status: 'married' };
        if (person.sex === 'M') fd.husbandId = person.id; else fd.wifeId = person.id;
        await window.api.addFamily(currentTreeId, fd);
      }
    } else if (type === 'spouse') {
      var fd = { childIds: [], status: 'married' };
      if (person.sex === 'M') { fd.husbandId = person.id; fd.wifeId = np.id; } else { fd.wifeId = person.id; fd.husbandId = np.id; }
      await window.api.addFamily(currentTreeId, fd);
    } else if (type === 'parent') {
      var fam = allFamilies.find(function(f) { return (f.childIds || []).indexOf(person.id) !== -1; });
      if (fam) {
        if (!fam.husband_id && sex === 'M') await window.api.updateFamily(fam.id, { husbandId: np.id });
        else if (!fam.wife_id && sex === 'F') await window.api.updateFamily(fam.id, { wifeId: np.id });
        else if (!fam.husband_id) await window.api.updateFamily(fam.id, { husbandId: np.id });
        else await window.api.updateFamily(fam.id, { wifeId: np.id });
      } else {
        var fd = { childIds: [person.id] };
        if (sex === 'M') fd.husbandId = np.id; else fd.wifeId = np.id;
        await window.api.addFamily(currentTreeId, fd);
      }
    } else if (type === 'sibling') {
      var chosenId = parseInt(sibFam.value);
      if (chosenId) { await window.api.updateFamily(chosenId, { addChildId: np.id }); }
      else {
        var fam = allFamilies.find(function(f) { return (f.childIds || []).indexOf(person.id) !== -1; });
        if (fam) await window.api.updateFamily(fam.id, { addChildId: np.id });
        else await window.api.addFamily(currentTreeId, { husbandId: null, wifeId: null, childIds: [person.id, np.id] });
      }
    }
    await refreshData();
    alert(name + ' added as ' + type + '.');
  });
}

// ─── Edit Profile ────────────────────────────────────────────────────

function showEditForm(person) {
  var sb = getEl('sidebar');
  sb.innerHTML = '<button class="back-link" id="backBtn"><span class="material-symbols-outlined" style="font-size:16px">arrow_back</span> Back</button>'
    + '<div class="sidebar-name" style="font-size:18px">Edit Profile</div>'
    + '<div class="form-group"><label class="form-label">Title (e.g. Dr., Rev., Deacon)</label><input id="editTitle" class="form-input" value="' + esc(person.title || '') + '" placeholder="e.g. Dr., Esquire, Deacon"/></div>'
    + '<div class="form-group"><label class="form-label">Full Name</label><input id="editName" class="form-input" value="' + esc(person.name || '') + '"/></div>'
    + '<div class="form-group"><label class="form-label">Suffix (e.g. Jr., Sr., III)</label><input id="editSuffix" class="form-input" value="' + esc(person.suffix || '') + '" placeholder="e.g. Jr., Sr., III, Esq."/></div>'
    + '<div class="form-group"><label class="form-label">Sex</label><select id="editSex" class="form-select"><option value="F"' + (person.sex === 'F' ? ' selected' : '') + '>Female</option><option value="M"' + (person.sex === 'M' ? ' selected' : '') + '>Male</option><option value=""' + (!person.sex ? ' selected' : '') + '>Unknown</option></select></div>'
    + '<div class="form-group"><label class="form-label">Birth Date</label><input id="editBirth" class="form-input" value="' + esc(person.birth_date || '') + '" placeholder="e.g. jan 5 1892, about 1670, between 1860 and 1870"/><div class="date-hint" id="birthHint"></div></div>'
    + '<div class="form-group"><label class="form-label">Death Date</label><input id="editDeath" class="form-input" value="' + esc(person.death_date || '') + '" placeholder="Leave blank if living"/><div class="date-hint" id="deathHint"></div></div>'
    + '<div class="form-group"><label class="form-label">Cause of Death</label><input id="editCauseOfDeath" class="form-input" value="' + esc(person.cause_of_death || '') + '" placeholder="e.g. Heart failure"/></div>'
    + '<div class="form-group"><label class="form-label">Burial Location</label><input id="editBurial" class="form-input" value="' + esc(person.burial_location || '') + '" placeholder="e.g. Greenwood Cemetery, Brooklyn, NY"/></div>'
    + '<label class="form-checkbox-row"><input type="checkbox" id="editAdopted" class="form-checkbox"' + (person.is_adopted ? ' checked' : '') + '/> <span class="form-label" style="margin:0">Adopted</span></label>'
    + '<div class="form-group"><label class="form-label">Occupation</label><input id="editOccupation" class="form-input" value="' + esc(person.occupation || '') + '" placeholder="e.g. Teacher, Farmer, Attorney"/></div>'
    + '<div class="form-group"><label class="form-label">Religion</label><input id="editReligion" class="form-input" value="' + esc(person.religion || '') + '" placeholder="e.g. Catholic, Muslim, Baptist"/></div>'
    + '<div class="form-group"><label class="form-label">Address</label><input id="editAddress" class="form-input" value="' + esc(person.address || '') + '" placeholder="e.g. 123 Main St"/></div>'
    + '<div class="form-group"><label class="form-label">Country</label><input id="editCountry" class="form-input" value="' + esc(person.country || '') + '" placeholder="e.g. United States"/></div>'
    + '<div class="form-group"><label class="form-label">Notes <button type="button" id="expandNotesBtn" style="float:right;background:none;border:none;color:var(--primary);font-size:11px;font-weight:700;cursor:pointer">Expand</button></label><textarea id="editNotes" class="form-input" style="min-height:80px;resize:vertical" placeholder="Family stories, memories, context...">' + esc(person.notes || '') + '</textarea></div>'
    + '<button class="sidebar-btn primary" id="saveEditBtn"><span class="material-symbols-outlined">save</span> Save Changes</button>'
    + '<div style="margin-top:20px;border-top:1px solid var(--outline);padding-top:16px">'
    + '<div id="eventsSection"></div>'
    + '</div>'
    + '<div style="margin-top:16px;border-top:1px solid var(--outline);padding-top:16px">'
    + '<div id="attachmentsSection"></div>'
    + '</div>';

  // Date parsing hints
  setupDateHint('editBirth', 'birthHint');
  setupDateHint('editDeath', 'deathHint');

  var expandNotesBtn = getEl('expandNotesBtn');
  if (expandNotesBtn) {
    expandNotesBtn.addEventListener('click', function() {
      showExpandedNotes(person, getEl('editNotes'));
    });
  }

  getEl('backBtn').addEventListener('click', function() { renderSidebar(); });
  getEl('saveEditBtn').addEventListener('click', async function() {
    var name = getEl('editName').value.trim();
    if (!name) { alert('Name is required.'); return; }

    var birthParsed = parseGenealogyDate(getEl('editBirth').value.trim());
    var deathParsed = parseGenealogyDate(getEl('editDeath').value.trim());

    var updateData = {
      title: getEl('editTitle').value.trim() || null,
      name: name,
      suffix: getEl('editSuffix').value.trim() || null,
      sex: getEl('editSex').value,
      birthDate: birthParsed.normalized || null,
      deathDate: deathParsed.normalized || null,
      causeOfDeath: getEl('editCauseOfDeath').value.trim() || null,
      burialLocation: getEl('editBurial').value.trim() || null,
      isAdopted: getEl('editAdopted').checked,
      occupation: getEl('editOccupation').value.trim() || null,
      religion: getEl('editReligion').value.trim() || null,
      address: getEl('editAddress').value.trim() || null,
      country: getEl('editCountry').value.trim() || null,
      notes: getEl('editNotes').value.trim() || null
    };

    console.log('Saving person update:', JSON.stringify(updateData));

    try {
      var result = await window.api.updatePerson(person.id, updateData);
      console.log('Update result:', result);
      await refreshData();
      alert('Profile updated.');
    } catch(err) {
      console.error('Update failed:', err);
      alert('Save failed: ' + (err.message || err));
    }
  });

  // Load events and attachments
  loadEventsSection(person);
  loadAttachmentsSection(person);
}

function setupDateHint(inputId, hintId) {
  var input = getEl(inputId);
  var hint = getEl(hintId);
  if (!input || !hint) return;

  function updateHint() {
    var val = input.value.trim();
    if (!val) { hint.textContent = ''; return; }
    var parsed = parseGenealogyDate(val);
    if (parsed.normalized && parsed.normalized !== val) {
      hint.textContent = '\u2192 ' + parsed.display;
    } else {
      hint.textContent = '';
    }
  }
  input.addEventListener('input', updateHint);
  input.addEventListener('blur', updateHint);
  updateHint();
}

// ─── Events Section ──────────────────────────────────────────────────

var EVENT_TYPES = [
  'birth', 'death', 'marriage', 'burial',
  'residence', 'immigration', 'naturalization',
  'military service', 'education', 'occupation',
  'elected office', 'court case', 'religious event',
  'medical', 'travel', 'achievement', 'other'
];

async function loadEventsSection(person) {
  var container = getEl('eventsSection');
  if (!container) return;

  var events = await window.api.getEvents(person.id);

  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    + '<div class="meta-label" style="margin:0">Life Events</div>'
    + '<button class="sidebar-btn ghost" style="padding:4px 10px;font-size:11px;margin:0;width:auto" id="addEventBtn">'
    + '<span class="material-symbols-outlined" style="font-size:14px">add</span> Add Event</button>'
    + '</div>';

  if (events.length === 0) {
    h += '<div style="font-size:12px;color:var(--secondary);text-align:center;padding:12px">No events recorded yet.</div>';
  } else {
    events.forEach(function(ev) {
      var dateParsed = parseGenealogyDate(ev.event_date || '');
      h += '<div class="event-item">'
        + '<div class="event-dot"></div>'
        + '<div style="flex:1;min-width:0">'
        + '<div class="event-type">' + esc(ev.event_type) + '</div>'
        + (ev.event_date ? '<div class="event-date">' + esc(dateParsed.display || ev.event_date) + '</div>' : '')
        + (ev.event_place ? '<div class="event-place">' + esc(ev.event_place) + '</div>' : '')
        + (ev.description ? '<div class="event-desc">' + esc(ev.description) + '</div>' : '')
        + '</div>'
        + '<div class="event-actions">'
        + '<button data-delete-event="' + ev.id + '" title="Delete"><span class="material-symbols-outlined" style="font-size:14px;color:var(--danger)">close</span></button>'
        + '</div>'
        + '</div>';
    });
  }

  container.innerHTML = h;

  getEl('addEventBtn').addEventListener('click', function() { showAddEventForm(person); });

  container.querySelectorAll('[data-delete-event]').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var eid = parseInt(this.dataset.deleteEvent);
      if (confirm('Delete this event?')) {
        await window.api.removeEvent(eid);
        loadEventsSection(person);
      }
    });
  });
}

function showAddEventForm(person) {
  var container = getEl('eventsSection');
  if (!container) return;

  var typeOptions = '';
  EVENT_TYPES.forEach(function(t) {
    typeOptions += '<option value="' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>';
  });

  container.innerHTML = '<div class="meta-label" style="margin-bottom:8px">Add Life Event</div>'
    + '<div class="form-group"><label class="form-label">Type</label><select id="eventType" class="form-select">' + typeOptions + '</select></div>'
    + '<div class="form-group"><label class="form-label">Date</label><input id="eventDate" class="form-input" placeholder="e.g. june 1945, about 1920"/><div class="date-hint" id="eventDateHint"></div></div>'
    + '<div class="form-group"><label class="form-label">Place / Location</label><input id="eventPlace" class="form-input" placeholder="e.g. Ellis Island, New York"/></div>'
    + '<div class="form-group"><label class="form-label">Details</label><textarea id="eventDesc" class="form-input" style="min-height:50px;resize:vertical" placeholder="Details — e.g. branch of service, degree, office held..."></textarea></div>'
    + '<div style="display:flex;gap:6px">'
    + '<button class="sidebar-btn ghost" style="flex:1" id="cancelEventBtn">Cancel</button>'
    + '<button class="sidebar-btn primary" style="flex:1" id="saveEventBtn"><span class="material-symbols-outlined" style="font-size:14px">save</span> Save</button>'
    + '</div>';

  setupDateHint('eventDate', 'eventDateHint');

  getEl('cancelEventBtn').addEventListener('click', function() { loadEventsSection(person); });
  getEl('saveEventBtn').addEventListener('click', async function() {
    var type = getEl('eventType').value;
    var dateParsed = parseGenealogyDate(getEl('eventDate').value.trim());
    var place = getEl('eventPlace').value.trim();
    var desc = getEl('eventDesc').value.trim();

    await window.api.addEvent(person.id, currentTreeId, {
      eventType: type,
      eventDate: dateParsed.normalized || null,
      eventPlace: place || null,
      description: desc || null
    });
    loadEventsSection(person);
  });
}

// ─── Attachments Section ─────────────────────────────────────────────

async function loadAttachmentsSection(person) {
  var container = getEl('attachmentsSection');
  if (!container) return;

  var attachments = await window.api.getAttachments(person.id);

  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    + '<div class="meta-label" style="margin:0">Attachments</div>'
    + '<button class="sidebar-btn ghost" style="padding:4px 10px;font-size:11px;margin:0;width:auto" id="addAttachBtn">'
    + '<span class="material-symbols-outlined" style="font-size:14px">attach_file</span> Add Files</button>'
    + '</div>';

  if (attachments.length === 0) {
    h += '<div style="font-size:12px;color:var(--secondary);text-align:center;padding:12px">No attachments yet.</div>';
  } else {
    attachments.forEach(function(att) {
      var iconClass = att.file_type === 'photo' ? 'photo' : att.file_type === 'pdf' ? 'pdf' : 'document';
      var iconName = att.file_type === 'photo' ? 'image' : att.file_type === 'pdf' ? 'picture_as_pdf' : 'description';
      h += '<div class="attachment-item" data-open-attachment="' + esc(att.file_path) + '">'
        + '<div class="attachment-icon ' + iconClass + '"><span class="material-symbols-outlined" style="font-size:18px">' + iconName + '</span></div>'
        + '<div style="flex:1;min-width:0">'
        + '<div class="attachment-name">' + esc(att.display_name) + '</div>'
        + (att.description ? '<div class="attachment-meta">' + esc(att.description) + '</div>' : '')
        + '</div>'
        + '<button data-delete-attachment="' + att.id + '" style="background:none;border:none;cursor:pointer;padding:4px" title="Remove">'
        + '<span class="material-symbols-outlined" style="font-size:16px;color:var(--danger)">close</span></button>'
        + '</div>';
    });
  }

  container.innerHTML = h;

  getEl('addAttachBtn').addEventListener('click', async function() {
    var added = await window.api.addAttachment(person.id, currentTreeId);
    if (added && added.length > 0) loadAttachmentsSection(person);
  });

  container.querySelectorAll('[data-delete-attachment]').forEach(function(btn) {
    btn.addEventListener('click', async function(e) {
      e.stopPropagation();
      var aid = parseInt(this.dataset.deleteAttachment);
      if (confirm('Remove this attachment?')) {
        await window.api.removeAttachment(aid);
        loadAttachmentsSection(person);
      }
    });
  });
}

// ─── Add First Person ────────────────────────────────────────────────

function showAddPersonForm() {
  var sb = getEl('sidebar');
  sb.innerHTML = '<div class="sidebar-name" style="font-size:18px">Add First Person</div>'
    + '<div class="sidebar-subtitle">Start your family tree.</div>'
    + '<div class="form-group"><label class="form-label">Full Name</label><input id="newName" class="form-input" placeholder="e.g. Jane Doe"/></div>'
    + '<div class="form-group"><label class="form-label">Sex</label><select id="newSex" class="form-select"><option value="F">Female</option><option value="M">Male</option><option value="">Unknown</option></select></div>'
    + '<div class="form-group"><label class="form-label">Birth Date</label><input id="newBirth" class="form-input" placeholder="e.g. 01 JAN 1960"/></div>'
    + '<div class="form-group"><label class="form-label">Country</label><input id="newCountry" class="form-input" placeholder="e.g. United States"/></div>'
    + '<button class="sidebar-btn primary" id="saveNewBtn"><span class="material-symbols-outlined">save</span> Add Person</button>';

  getEl('saveNewBtn').addEventListener('click', async function() {
    var name = getEl('newName').value.trim();
    if (!name) { alert('Name is required.'); return; }
    var p = await window.api.addPerson(currentTreeId, {
      name: name,
      sex: getEl('newSex').value,
      birthDate: getEl('newBirth').value.trim() || null,
      country: getEl('newCountry').value.trim() || null
    });
    selectedPersonId = p.id;
    await refreshData();
    alert(name + ' added.');
  });
}

// ─── Edit Marriage Details ────────────────────────────────────────

function showEditMarriageForm(famId, person) {
  var sb = getEl('sidebar');
  var fam = allFamilies.find(function(f) { return f.id === famId; });
  if (!fam) return;

  var husband = fam.husband_id ? personById(fam.husband_id) : null;
  var wife = fam.wife_id ? personById(fam.wife_id) : null;
  var spouseName = '';
  if (husband && wife) spouseName = esc(husband.name) + ' & ' + esc(wife.name);
  else if (husband) spouseName = esc(husband.name);
  else if (wife) spouseName = esc(wife.name);

  sb.innerHTML = '<button class="back-link" id="backBtn"><span class="material-symbols-outlined" style="font-size:16px">arrow_back</span> Back</button>'
    + '<div class="sidebar-name" style="font-size:18px">Marriage Details</div>'
    + '<div class="sidebar-subtitle">' + spouseName + '</div>'
    + '<div class="form-group"><label class="form-label">Marriage Date</label>'
    + '<input id="marriageDate" class="form-input" value="' + esc(fam.marriage_date || '') + '" placeholder="e.g. june 15, 1985"/>'
    + '<div class="date-hint" id="marriageDateHint"></div></div>'
    + '<div class="form-group"><label class="form-label">Marriage Place</label>'
    + '<input id="marriagePlace" class="form-input" value="' + esc(fam.marriage_place || '') + '" placeholder="e.g. St. Patrick\'s Church, Boston"/></div>'
    + '<div class="form-group"><label class="form-label">Status</label>'
    + '<select id="marriageStatus" class="form-select">'
    + '<option value="married"' + (fam.status !== 'divorced' ? ' selected' : '') + '>Married</option>'
    + '<option value="divorced"' + (fam.status === 'divorced' ? ' selected' : '') + '>Divorced</option>'
    + '</select></div>'
    + '<button class="sidebar-btn primary" id="saveMarriageBtn"><span class="material-symbols-outlined">save</span> Save</button>';

  setupDateHint('marriageDate', 'marriageDateHint');

  getEl('backBtn').addEventListener('click', function() { renderSidebar(); });
  getEl('saveMarriageBtn').addEventListener('click', async function() {
    var dateParsed = parseGenealogyDate(getEl('marriageDate').value.trim());
    await window.api.updateFamily(famId, {
      marriageDate: dateParsed.normalized || null,
      marriagePlace: getEl('marriagePlace').value.trim() || null,
      status: getEl('marriageStatus').value
    });
    await refreshData();
    alert('Marriage details updated.');
  });
}

// ─── Relationship Calculator ─────────────────────────────────────

var relCalcPersonA = null;

function showRelationshipCalc(startPerson) {
  var sb = getEl('sidebar');
  relCalcPersonA = startPerson;

  var peopleOptions = '';
  allPeople.forEach(function(p) {
    if (p.id !== startPerson.id) {
      peopleOptions += '<option value="' + p.id + '">' + esc(p.name) + '</option>';
    }
  });

  sb.innerHTML = '<button class="back-link" id="backBtn"><span class="material-symbols-outlined" style="font-size:16px">arrow_back</span> Back</button>'
    + '<div class="sidebar-name" style="font-size:18px">Find Relationship</div>'
    + '<div class="rel-calc-bar"><span class="material-symbols-outlined">person</span>'
    + '<span class="rel-calc-label">' + esc(startPerson.name) + '</span></div>'
    + '<div class="form-group"><label class="form-label">Related to...</label>'
    + '<select id="relCalcTarget" class="form-select"><option value="">— Select a person —</option>'
    + peopleOptions + '</select></div>'
    + '<div id="relCalcResult"></div>';

  getEl('backBtn').addEventListener('click', function() { renderSidebar(); });

  getEl('relCalcTarget').addEventListener('change', function() {
    var targetId = parseInt(this.value);
    if (!targetId) { getEl('relCalcResult').innerHTML = ''; return; }
    var targetPerson = personById(targetId);
    if (!targetPerson) return;
    var result = calculateRelationship(startPerson, targetPerson);
    var container = getEl('relCalcResult');
    container.innerHTML = '<div class="rel-calc-result">'
      + '<div style="font-family:var(--font-headline);font-weight:700;font-size:16px;color:var(--primary)">'
      + esc(result.relationship) + '</div>'
      + '<div class="path" style="margin-top:8px">'
      + '<strong>' + esc(startPerson.name) + '</strong> is the <strong>'
      + esc(result.relationship.toLowerCase()) + '</strong> of <strong>'
      + esc(targetPerson.name) + '</strong></div>'
      + (result.path.length > 0 ? '<div class="path" style="margin-top:6px">Path: ' + result.path.map(function(p) { return esc(p); }).join(' → ') + '</div>' : '')
      + '</div>';
  });
}

function calculateRelationship(personA, personB) {
  if (personA.id === personB.id) return { relationship: 'Same person', path: [] };

  // Build ancestor maps using BFS
  var ancestorsA = buildAncestorMap(personA);
  var ancestorsB = buildAncestorMap(personB);

  // Check direct relationships first
  // Is B a parent of A?
  var parentsA = getParentsOf(personA);
  for (var i = 0; i < parentsA.length; i++) {
    if (parentsA[i].id === personB.id) {
      return { relationship: personB.sex === 'M' ? 'Father' : 'Mother', path: [personA.name, personB.name] };
    }
  }

  // Is B a child of A?
  var childrenA = getChildrenOf(personA);
  for (var i = 0; i < childrenA.length; i++) {
    if (childrenA[i].id === personB.id) {
      return { relationship: personB.sex === 'M' ? 'Son' : 'Daughter', path: [personA.name, personB.name] };
    }
  }

  // Is B a spouse of A?
  var spousesA = getSpousesOf(personA);
  for (var i = 0; i < spousesA.length; i++) {
    if (spousesA[i].id === personB.id) {
      return { relationship: personB.sex === 'M' ? 'Husband' : 'Wife', path: [personA.name, personB.name] };
    }
  }

  // Is B a sibling of A?
  var siblingsA = getSiblingsOf(personA);
  for (var i = 0; i < siblingsA.length; i++) {
    if (siblingsA[i].id === personB.id) {
      return { relationship: personB.sex === 'M' ? 'Brother' : 'Sister', path: [personA.name, personB.name] };
    }
  }

  // Find common ancestor
  var commonAncestor = null;
  var genA = 0;
  var genB = 0;

  // Check all ancestors of A against all ancestors of B
  var bestTotal = 999;
  for (var idA in ancestorsA) {
    if (ancestorsB.hasOwnProperty(idA)) {
      var total = ancestorsA[idA].gen + ancestorsB[idA].gen;
      if (total < bestTotal) {
        bestTotal = total;
        commonAncestor = parseInt(idA);
        genA = ancestorsA[idA].gen;
        genB = ancestorsB[idA].gen;
      }
    }
  }

  if (commonAncestor) {
    var ancestor = personById(commonAncestor);
    var ancestorName = ancestor ? ancestor.name : 'Unknown';
    var rel = describeRelationship(genA, genB, personB.sex);
    var path = [personA.name];
    if (ancestor) path.push(ancestorName);
    path.push(personB.name);
    return { relationship: rel, path: path };
  }

  // Check in-law relationships through spouses
  for (var si = 0; si < spousesA.length; si++) {
    var spouseAncestors = buildAncestorMap(spousesA[si]);
    for (var idS in spouseAncestors) {
      if (ancestorsB.hasOwnProperty(idS)) {
        var rel = describeRelationship(spouseAncestors[idS].gen, ancestorsB[idS].gen, personB.sex);
        return { relationship: rel + ' (by marriage)', path: [personA.name, spousesA[si].name, personB.name] };
      }
    }
    // Is B a parent of the spouse?
    var spouseParents = getParentsOf(spousesA[si]);
    for (var pi = 0; pi < spouseParents.length; pi++) {
      if (spouseParents[pi].id === personB.id) {
        return { relationship: personB.sex === 'M' ? 'Father-in-law' : 'Mother-in-law', path: [personA.name, spousesA[si].name, personB.name] };
      }
    }
    // Is B a sibling of the spouse?
    var spouseSiblings = getSiblingsOf(spousesA[si]);
    for (var bi = 0; bi < spouseSiblings.length; bi++) {
      if (spouseSiblings[bi].id === personB.id) {
        return { relationship: personB.sex === 'M' ? 'Brother-in-law' : 'Sister-in-law', path: [personA.name, spousesA[si].name, personB.name] };
      }
    }
  }

  // Check if B's spouse is a sibling of A (also in-law)
  var spousesB = getSpousesOf(personB);
  for (var sbi = 0; sbi < spousesB.length; sbi++) {
    for (var sai = 0; sai < siblingsA.length; sai++) {
      if (spousesB[sbi].id === siblingsA[sai].id) {
        return { relationship: personB.sex === 'M' ? 'Brother-in-law' : 'Sister-in-law', path: [personA.name, siblingsA[sai].name, personB.name] };
      }
    }
  }

  return { relationship: 'No direct relationship found', path: [] };
}

function buildAncestorMap(person) {
  var map = {};
  var queue = [{ id: person.id, gen: 0 }];
  var visited = {};

  while (queue.length > 0) {
    var current = queue.shift();
    if (visited[current.id]) continue;
    visited[current.id] = true;
    map[current.id] = { gen: current.gen };

    var p = personById(current.id);
    if (!p) continue;
    var parents = getParentsOf(p);
    for (var i = 0; i < parents.length; i++) {
      if (!visited[parents[i].id]) {
        queue.push({ id: parents[i].id, gen: current.gen + 1 });
      }
    }
  }
  return map;
}

function describeRelationship(genA, genB, sex) {
  // genA = generations from person A to common ancestor
  // genB = generations from person B to common ancestor
  if (genA === 0 && genB === 0) return 'Same person';

  // Direct line
  if (genA === 0) {
    if (genB === 1) return sex === 'M' ? 'Father' : 'Mother';
    if (genB === 2) return sex === 'M' ? 'Grandfather' : 'Grandmother';
    if (genB === 3) return sex === 'M' ? 'Great-Grandfather' : 'Great-Grandmother';
    var greats = genB - 2;
    var prefix = '';
    for (var g = 0; g < greats; g++) prefix += 'Great-';
    return prefix + (sex === 'M' ? 'Grandfather' : 'Grandmother');
  }
  if (genB === 0) {
    if (genA === 1) return sex === 'M' ? 'Son' : 'Daughter';
    if (genA === 2) return sex === 'M' ? 'Grandson' : 'Granddaughter';
    if (genA === 3) return sex === 'M' ? 'Great-Grandson' : 'Great-Granddaughter';
    var greats = genA - 2;
    var prefix = '';
    for (var g = 0; g < greats; g++) prefix += 'Great-';
    return prefix + (sex === 'M' ? 'Grandson' : 'Granddaughter');
  }

  // Siblings
  if (genA === 1 && genB === 1) return sex === 'M' ? 'Brother' : 'Sister';

  // Uncle/Aunt/Nephew/Niece
  if (genA === 1 && genB === 2) return sex === 'M' ? 'Uncle' : 'Aunt';
  if (genA === 2 && genB === 1) return sex === 'M' ? 'Nephew' : 'Niece';
  if (genA === 1 && genB === 3) return sex === 'M' ? 'Great-Uncle' : 'Great-Aunt';
  if (genA === 3 && genB === 1) return sex === 'M' ? 'Great-Nephew' : 'Great-Niece';

  // Cousins
  var cousinDegree = Math.min(genA, genB) - 1;
  var removed = Math.abs(genA - genB);

  if (cousinDegree < 1) cousinDegree = 1;

  var ordinal = '';
  if (cousinDegree === 1) ordinal = '1st';
  else if (cousinDegree === 2) ordinal = '2nd';
  else if (cousinDegree === 3) ordinal = '3rd';
  else ordinal = cousinDegree + 'th';

  var result = ordinal + ' Cousin';
  if (removed > 0) {
    result += ' ' + removed + ' time' + (removed > 1 ? 's' : '') + ' removed';
  }
  return result;
}

// ─── Expanded Notes Modal ─────────────────────────────────────────

function showExpandedNotes(person, textareaEl) {
  var old = document.querySelector('.modal-overlay');
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  var modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.width = '600px';
  modal.style.maxHeight = '80vh';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';

  var title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = 'Notes — ' + fullName(person);
  modal.appendChild(title);

  var textarea = document.createElement('textarea');
  textarea.className = 'form-input';
  textarea.style.flex = '1';
  textarea.style.minHeight = '300px';
  textarea.style.resize = 'vertical';
  textarea.style.fontFamily = 'var(--font-body)';
  textarea.style.fontSize = '14px';
  textarea.style.lineHeight = '1.6';
  textarea.placeholder = 'Write notes, family stories, memories, research findings...\n\nYou can use multiple lines and paragraphs.';
  textarea.value = textareaEl ? textareaEl.value : (person.notes || '');
  modal.appendChild(textarea);

  var actions = document.createElement('div');
  actions.className = 'modal-actions';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'modal-btn cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.type = 'button';

  var saveBtn = document.createElement('button');
  saveBtn.className = 'modal-btn confirm';
  saveBtn.textContent = 'Save Notes';
  saveBtn.type = 'button';

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  modal.appendChild(actions);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  textarea.focus();

  cancelBtn.addEventListener('click', function() { overlay.remove(); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

  saveBtn.addEventListener('click', function() {
    var val = textarea.value;
    if (textareaEl) textareaEl.value = val;
    overlay.remove();
  });
}

// ─── Family Report Generator ─────────────────────────────────────

async function generateFamilyReport() {
  var treeName = getEl('treeTitle') ? getEl('treeTitle').textContent : 'Family Tree';
  var today = new Date().toLocaleDateString();

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<style>'
    + 'body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.5; }'
    + 'h1 { font-size: 28px; text-align: center; margin-bottom: 4px; }'
    + '.subtitle { text-align: center; color: #666; font-size: 13px; margin-bottom: 30px; }'
    + '.person-section { page-break-inside: avoid; margin-bottom: 28px; border-bottom: 1px solid #ddd; padding-bottom: 20px; }'
    + '.person-name { font-size: 20px; font-weight: bold; margin-bottom: 4px; }'
    + '.person-dates { font-size: 14px; color: #555; margin-bottom: 10px; }'
    + '.detail-grid { display: grid; grid-template-columns: 140px 1fr; gap: 4px 12px; font-size: 13px; margin-bottom: 10px; }'
    + '.detail-label { font-weight: bold; color: #555; }'
    + '.detail-value { color: #1a1a1a; }'
    + '.section-header { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-top: 12px; margin-bottom: 4px; }'
    + '.family-block { background: #f8f8f8; padding: 10px 14px; border-radius: 6px; margin-bottom: 8px; font-size: 13px; }'
    + '.events-list { font-size: 13px; }'
    + '.event-row { margin-bottom: 4px; }'
    + '.event-type { font-weight: bold; text-transform: capitalize; }'
    + '.notes-block { font-size: 13px; white-space: pre-wrap; background: #fafafa; padding: 10px 14px; border-radius: 6px; border-left: 3px solid #ccc; }'
    + '.toc { margin-bottom: 30px; }'
    + '.toc-item { font-size: 13px; margin-bottom: 2px; }'
    + '.toc-item a { color: #0051d5; text-decoration: none; }'
    + '@media print { .person-section { page-break-inside: avoid; } }'
    + '</style></head><body>';

  html += '<h1>' + esc(treeName) + '</h1>';
  html += '<div class="subtitle">Family Report — Generated ' + today + '</div>';

  // Table of contents
  html += '<div class="toc"><div class="section-header">Index of People</div>';
  allPeople.forEach(function(p, i) {
    html += '<div class="toc-item">' + (i + 1) + '. ' + esc(fullName(p));
    var dates = [];
    if (p.birth_date) dates.push('b. ' + p.birth_date);
    if (p.death_date) dates.push('d. ' + p.death_date);
    if (dates.length) html += ' <span style="color:#888">(' + dates.join(', ') + ')</span>';
    html += '</div>';
  });
  html += '</div>';

  // Each person
  for (var pi = 0; pi < allPeople.length; pi++) {
    var p = allPeople[pi];
    var parents = getParentsOf(p);
    var spouses = getSpousesOf(p);
    var children = getChildrenOf(p);
    var siblings = getSiblingsOf(p);
    var spFams = getSpouseFamilies(p);

    html += '<div class="person-section">';
    html += '<div class="person-name">' + (pi + 1) + '. ' + esc(fullName(p)) + '</div>';

    var dateStr = [];
    if (p.birth_date) dateStr.push('Born: ' + parseGenealogyDate(p.birth_date).display);
    if (p.death_date) dateStr.push('Died: ' + parseGenealogyDate(p.death_date).display);
    if (dateStr.length) html += '<div class="person-dates">' + dateStr.join(' — ') + '</div>';

    html += '<div class="detail-grid">';
    if (p.sex) html += '<div class="detail-label">Sex</div><div class="detail-value">' + (p.sex === 'M' ? 'Male' : p.sex === 'F' ? 'Female' : p.sex) + '</div>';
    if (p.occupation) html += '<div class="detail-label">Occupation</div><div class="detail-value">' + esc(p.occupation) + '</div>';
    if (p.religion) html += '<div class="detail-label">Religion</div><div class="detail-value">' + esc(p.religion) + '</div>';
    if (p.address) html += '<div class="detail-label">Address</div><div class="detail-value">' + esc(p.address) + '</div>';
    if (p.country) html += '<div class="detail-label">Country</div><div class="detail-value">' + esc(p.country) + '</div>';
    if (p.burial_location) html += '<div class="detail-label">Burial</div><div class="detail-value">' + esc(p.burial_location) + '</div>';
    if (p.cause_of_death) html += '<div class="detail-label">Cause of Death</div><div class="detail-value">' + esc(p.cause_of_death) + '</div>';
    if (p.is_adopted) html += '<div class="detail-label">Status</div><div class="detail-value">Adopted</div>';
    html += '</div>';

    // Family connections
    if (parents.length) {
      html += '<div class="section-header">Parents</div>';
      html += '<div class="family-block">' + parents.map(function(pa) { return esc(fullName(pa)); }).join(', ') + '</div>';
    }

    if (spouses.length) {
      spouses.forEach(function(sp) {
        var fam = spFams.find(function(f) { return f.husband_id === sp.id || f.wife_id === sp.id; });
        var status = fam && fam.status === 'divorced' ? ' (Divorced)' : '';
        var mDate = fam && fam.marriage_date ? ' — Married ' + parseGenealogyDate(fam.marriage_date).display : '';
        var mPlace = fam && fam.marriage_place ? ' at ' + fam.marriage_place : '';
        html += '<div class="section-header">Spouse</div>';
        html += '<div class="family-block">' + esc(fullName(sp)) + status + mDate + mPlace + '</div>';
      });
    }

    if (children.length) {
      html += '<div class="section-header">Children</div>';
      html += '<div class="family-block">';
      children.forEach(function(c, ci) {
        var cDates = [];
        if (c.birth_date) cDates.push('b. ' + c.birth_date);
        if (c.death_date) cDates.push('d. ' + c.death_date);
        html += (ci + 1) + '. ' + esc(fullName(c));
        if (c.is_adopted) html += ' (adopted)';
        if (cDates.length) html += ' <span style="color:#888">(' + cDates.join(', ') + ')</span>';
        html += '<br>';
      });
      html += '</div>';
    }

    if (siblings.length) {
      html += '<div class="section-header">Siblings</div>';
      html += '<div class="family-block">' + siblings.map(function(s) { return esc(fullName(s)); }).join(', ') + '</div>';
    }

    // Events
    var events = [];
    try { events = await window.api.getEvents(p.id); } catch(e) {}
    if (events.length) {
      html += '<div class="section-header">Life Events</div>';
      html += '<div class="events-list">';
      events.forEach(function(ev) {
        var evDate = ev.event_date ? parseGenealogyDate(ev.event_date).display : '';
        html += '<div class="event-row"><span class="event-type">' + esc(ev.event_type) + '</span>';
        if (evDate) html += ' — ' + esc(evDate);
        if (ev.event_place) html += ', ' + esc(ev.event_place);
        if (ev.description) html += ': ' + esc(ev.description);
        html += '</div>';
      });
      html += '</div>';
    }

    // Notes
    if (p.notes) {
      html += '<div class="section-header">Notes</div>';
      html += '<div class="notes-block">' + esc(p.notes) + '</div>';
    }

    html += '</div>';
  }

  html += '</body></html>';
  return html;
}

// ─── Trash View (deleted people) ─────────────────────────────────

async function showTrashView() {
  var sb = getEl('sidebar');
  var deleted = [];
  try { deleted = await window.api.getDeletedPeople(currentTreeId); } catch(e) {}

  var html = '<button class="back-link" id="trashBackBtn"><span class="material-symbols-outlined" style="font-size:16px">arrow_back</span> Back</button>'
    + '<div class="sidebar-name" style="font-size:18px">Recently Deleted</div>'
    + '<div class="sidebar-subtitle">People are permanently removed after 30 days.</div>';

  if (deleted.length === 0) {
    html += '<div style="text-align:center;padding:32px 0;color:var(--secondary)">'
      + '<span class="material-symbols-outlined" style="font-size:40px;display:block;margin-bottom:8px;color:var(--outline)">check_circle</span>'
      + 'Trash is empty</div>';
  } else {
    deleted.forEach(function(p) {
      var deletedDate = p.deleted_at ? new Date(p.deleted_at + 'Z').toLocaleDateString() : '';
      html += '<div style="background:var(--surface-low);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px">'
        + '<div style="font-family:var(--font-headline);font-weight:700;font-size:14px">' + esc(p.name) + '</div>'
        + '<div style="font-size:11px;color:var(--secondary);margin-bottom:8px">Deleted ' + deletedDate + '</div>'
        + '<div style="display:flex;gap:6px">'
        + '<button class="sidebar-btn secondary" style="padding:6px 10px;font-size:11px;margin:0;flex:1" data-restore-person="' + p.id + '">'
        + '<span class="material-symbols-outlined" style="font-size:14px">restore</span> Restore</button>'
        + '<button class="sidebar-btn danger" style="padding:6px 10px;font-size:11px;margin:0;flex:1" data-perm-delete-person="' + p.id + '">'
        + '<span class="material-symbols-outlined" style="font-size:14px">delete_forever</span> Delete Forever</button>'
        + '</div></div>';
    });
  }

  sb.innerHTML = html;

  getEl('trashBackBtn').addEventListener('click', function() { renderSidebar(); });

  document.querySelectorAll('[data-restore-person]').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var pid = parseInt(this.dataset.restorePerson);
      await window.api.restorePerson(pid);
      await refreshData();
      showTrashView(); // refresh the trash list
    });
  });

  document.querySelectorAll('[data-perm-delete-person]').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var pid = parseInt(this.dataset.permDeletePerson);
      var person = deleted.find(function(p) { return p.id === pid; });
      var name = person ? person.name : 'this person';
      if (confirm('Permanently delete ' + name + '? This cannot be undone.')) {
        await window.api.permanentlyDeletePerson(pid);
        await refreshData();
        showTrashView();
      }
    });
  });
}

// ─── Delete Person ───────────────────────────────────────────────────

async function deletePerson(person) {
  if (!confirm('Delete ' + person.name + '?')) return;
  await window.api.removePerson(person.id);
  selectedPersonId = null;
  await refreshData();
}