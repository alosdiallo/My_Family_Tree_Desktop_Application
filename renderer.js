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

// ═══════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing...');
  setupHeaderButtons();
  setupViewTabs();
  loadHomeScreen();
});

function setupHeaderButtons() {
  const backBtn = getEl('backToHomeBtn');
  const importBtn = getEl('importBtn');
  const exportBtn = getEl('exportBtn');
  const printBtn = getEl('printBtn');

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
  return kids;
}

function getSiblingsOf(person) {
  var fam = allFamilies.find(function(f) { return (f.childIds || []).indexOf(person.id) !== -1; });
  if (!fam) return [];
  return (fam.childIds || []).filter(function(cid) { return cid !== person.id; })
    .map(function(cid) { return personById(cid); }).filter(Boolean);
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
    + '<div class="person-card-name">' + esc(person.name) + '</div>'
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
    + '<div class="person-card-name" style="font-size:18px">' + esc(person.name) + '</div>'
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
  else if (currentView === 'map') { renderMapView(tc); return; } // map handles its own click bindings

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
  return '<tr><td data-person-id="' + p.id + '" style="font-weight:600;color:var(--secondary);cursor:pointer">' + role + '</td>'
    + '<td data-person-id="' + p.id + '" style="cursor:pointer"><div class="fg-name-cell">' + photoHtml(p) + '<span style="font-family:var(--font-headline);font-weight:600">' + esc(p.name) + '</span></div></td>'
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

  var mapW = 960;
  var mapH = 520;

  function toX(lng) { return ((lng + 180) / 360) * mapW; }
  function toY(lat) { return ((90 - lat) / 180) * mapH; }

  // Build SVG using proper world map
  var svg = '<svg viewBox="0 0 ' + mapW + ' ' + mapH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:960px;height:auto;border-radius:12px;overflow:hidden">';

  // Use the world map generator
  svg += generateWorldMapSVG(mapW, mapH);

  // Highlight countries that have family members
  countries.forEach(function(key) {
    var group = countryGroups[key];
    var cx = toX(group.country.lng);
    var cy = toY(group.country.lat);
    var count = group.people.length;
    var radius = Math.min(10 + count * 2.5, 22);

    // Pin drop shadow
    svg += '<ellipse cx="' + cx + '" cy="' + (cy + 3) + '" rx="' + (radius * 0.8) + '" ry="' + (radius * 0.4) + '" fill="rgba(0,0,0,0.12)"/>';

    // Pin body (teardrop shape)
    var pinTop = cy - radius;
    svg += '<path d="M' + cx + ',' + (cy + 4)
      + ' C' + (cx - radius) + ',' + cy + ' ' + (cx - radius) + ',' + pinTop
      + ' ' + cx + ',' + pinTop
      + ' C' + (cx + radius) + ',' + pinTop + ' ' + (cx + radius) + ',' + cy
      + ' ' + cx + ',' + (cy + 4) + 'Z"'
      + ' fill="#0051d5" stroke="white" stroke-width="1.5" style="cursor:pointer" data-map-country="' + esc(key) + '"/>';

    // Count in pin
    svg += '<text x="' + cx + '" y="' + (cy - radius * 0.35) + '" text-anchor="middle" dominant-baseline="middle" '
      + 'fill="white" font-size="' + Math.max(10, radius * 0.7) + '" font-weight="700" font-family="Inter,sans-serif" '
      + 'style="pointer-events:none">' + count + '</text>';

    // Country name below pin
    svg += '<text x="' + cx + '" y="' + (cy + radius * 0.6 + 14) + '" text-anchor="middle" '
      + 'fill="#191c1e" font-size="10" font-weight="600" font-family="Inter,sans-serif" '
      + 'style="pointer-events:none">' + esc(key) + '</text>';
  });

  svg += '</svg>';

  // Legend
  var legend = '<div class="map-legend">';
  legend += '<div class="map-legend-title">Family Origins</div>';
  countries.sort(function(a, b) { return countryGroups[b].people.length - countryGroups[a].people.length; });
  countries.forEach(function(key) {
    var group = countryGroups[key];
    legend += '<div class="map-legend-item" data-map-legend="' + esc(key) + '">'
      + '<div class="map-legend-dot"></div>'
      + '<div class="map-legend-text">'
      + '<div class="map-legend-country">' + esc(key) + '</div>'
      + '<div class="map-legend-count">' + group.people.length + ' ' + (group.people.length === 1 ? 'person' : 'people') + '</div>'
      + '</div></div>';
  });
  legend += '</div>';

  var detail = '<div id="mapDetail" class="map-detail"></div>';

  tc.innerHTML = '<div style="width:100%">'
    + '<div style="font-family:var(--font-headline);font-weight:700;font-size:18px;margin-bottom:16px">Family Map</div>'
    + '<div class="map-container">'
    + '<div class="map-svg-wrap">' + svg + '</div>'
    + '<div class="map-sidebar">' + legend + detail + '</div>'
    + '</div></div>';

  // Bind pin clicks
  tc.querySelectorAll('[data-map-country]').forEach(function(el) {
    el.addEventListener('click', function() {
      showMapCountryDetail(countryGroups[this.dataset.mapCountry]);
    });
  });

  // Bind legend clicks
  tc.querySelectorAll('[data-map-legend]').forEach(function(el) {
    el.addEventListener('click', function() {
      showMapCountryDetail(countryGroups[this.dataset.mapLegend]);
    });
  });
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
    + '<div class="sidebar-name">' + esc(person.name) + '</div>'
    + '<div class="sidebar-subtitle">Manage individual records</div>'
    + metaField('Sex', person.sex || '—')
    + metaField('Birth Date', person.birth_date || '—')
    + (person.death_date ? metaField('Death Date', person.death_date) : '')
    + (person.is_adopted ? metaField('Status', 'Adopted') : '')
    + (person.address ? metaField('Address', person.address) : '')
    + (person.country ? metaField('Country', person.country) : '')
    + (person.burial_location ? metaField('Burial Location', person.burial_location) : '')
    + (person.notes ? '<div class="meta-field"><div class="meta-label">Notes</div><div class="meta-value" style="font-size:13px;font-weight:400;white-space:pre-wrap">' + esc(person.notes) + '</div></div>' : '')
    + (spouseHtml ? '<div style="margin-bottom:10px"><div class="meta-label" style="margin-bottom:6px">Spouse(s)</div>' + spouseHtml + '</div>' : '')
    + (children.length ? metaField('Children', children.map(function(c) { return esc(c.name) + (c.is_adopted ? ' (adopted)' : ''); }).join(', ')) : '')
    + (siblings.length ? metaField('Siblings', siblings.map(function(s) { return esc(s.name); }).join(', ')) : '')
    + '<div style="margin-top:auto;padding-top:16px">'
    + '<button class="sidebar-btn ghost" id="photoBtn"><span class="material-symbols-outlined">add_a_photo</span> ' + (person.photo_path ? 'Change Photo' : 'Add Photo') + '</button>'
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
    + '<div class="form-group"><label class="form-label">Full Name</label><input id="editName" class="form-input" value="' + esc(person.name || '') + '"/></div>'
    + '<div class="form-group"><label class="form-label">Sex</label><select id="editSex" class="form-select"><option value="F"' + (person.sex === 'F' ? ' selected' : '') + '>Female</option><option value="M"' + (person.sex === 'M' ? ' selected' : '') + '>Male</option><option value=""' + (!person.sex ? ' selected' : '') + '>Unknown</option></select></div>'
    + '<div class="form-group"><label class="form-label">Birth Date</label><input id="editBirth" class="form-input" value="' + esc(person.birth_date || '') + '" placeholder="e.g. jan 5 1892, about 1670, between 1860 and 1870"/><div class="date-hint" id="birthHint"></div></div>'
    + '<div class="form-group"><label class="form-label">Death Date</label><input id="editDeath" class="form-input" value="' + esc(person.death_date || '') + '" placeholder="Leave blank if living"/><div class="date-hint" id="deathHint"></div></div>'
    + '<div class="form-group"><label class="form-label">Burial Location</label><input id="editBurial" class="form-input" value="' + esc(person.burial_location || '') + '" placeholder="e.g. Greenwood Cemetery, Brooklyn, NY"/></div>'
    + '<label class="form-checkbox-row"><input type="checkbox" id="editAdopted" class="form-checkbox"' + (person.is_adopted ? ' checked' : '') + '/> <span class="form-label" style="margin:0">Adopted</span></label>'
    + '<div class="form-group"><label class="form-label">Address</label><input id="editAddress" class="form-input" value="' + esc(person.address || '') + '" placeholder="e.g. 123 Main St"/></div>'
    + '<div class="form-group"><label class="form-label">Country</label><input id="editCountry" class="form-input" value="' + esc(person.country || '') + '" placeholder="e.g. United States"/></div>'
    + '<div class="form-group"><label class="form-label">Notes</label><textarea id="editNotes" class="form-input" style="min-height:80px;resize:vertical" placeholder="Family stories, memories, context...">' + esc(person.notes || '') + '</textarea></div>'
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

  getEl('backBtn').addEventListener('click', function() { renderSidebar(); });
  getEl('saveEditBtn').addEventListener('click', async function() {
    var name = getEl('editName').value.trim();
    if (!name) { alert('Name is required.'); return; }

    var birthParsed = parseGenealogyDate(getEl('editBirth').value.trim());
    var deathParsed = parseGenealogyDate(getEl('editDeath').value.trim());

    var updateData = {
      name: name,
      sex: getEl('editSex').value,
      birthDate: birthParsed.normalized || null,
      deathDate: deathParsed.normalized || null,
      burialLocation: getEl('editBurial').value.trim() || null,
      isAdopted: getEl('editAdopted').checked,
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
  'immigration', 'naturalization', 'military service',
  'residence', 'education', 'occupation',
  'court case', 'office holding', 'religious event',
  'other'
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
    + '<div class="form-group"><label class="form-label">Place</label><input id="eventPlace" class="form-input" placeholder="e.g. Ellis Island, New York"/></div>'
    + '<div class="form-group"><label class="form-label">Description</label><textarea id="eventDesc" class="form-input" style="min-height:50px;resize:vertical" placeholder="Details about this event..."></textarea></div>'
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