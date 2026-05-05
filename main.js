const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'family-tree.sqlite');
const photosDir = path.join(userDataPath, 'photos');
const backupsDir = path.join(userDataPath, 'backups');
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

const MAX_BACKUPS = 20;
const SOFT_DELETE_DAYS = 30;
let autoBackupInterval = null;
let db;

// ═══════════════════════════════════════════════════════════════════
// BACKUP SYSTEM
// ═══════════════════════════════════════════════════════════════════

function createBackup(reason) {
  try {
    if (!db) return null;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = 'backup-' + reason + '-' + timestamp + '.sqlite';
    const dest = path.join(backupsDir, filename);
    const data = db.export();
    fs.writeFileSync(dest, Buffer.from(data));
    pruneOldBackups();
    console.log('Backup created:', filename);
    return dest;
  } catch (err) {
    console.error('Backup failed:', err);
    return null;
  }
}

function pruneOldBackups() {
  try {
    var files = fs.readdirSync(backupsDir)
      .filter(function(f) { return f.startsWith('backup-') && f.endsWith('.sqlite'); })
      .map(function(f) {
        var stat = fs.statSync(path.join(backupsDir, f));
        return { name: f, time: stat.mtimeMs };
      })
      .sort(function(a, b) { return b.time - a.time; });

    // Keep only MAX_BACKUPS most recent
    for (var i = MAX_BACKUPS; i < files.length; i++) {
      fs.unlinkSync(path.join(backupsDir, files[i].name));
      console.log('Pruned old backup:', files[i].name);
    }
  } catch (err) {
    console.error('Backup prune failed:', err);
  }
}

function startAutoBackup() {
  // Backup on launch
  createBackup('auto');
  // Backup every 30 minutes
  autoBackupInterval = setInterval(function() {
    createBackup('auto');
  }, 30 * 60 * 1000);
}

function purgeSoftDeleted() {
  // Permanently remove records soft-deleted more than SOFT_DELETE_DAYS ago
  try {
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SOFT_DELETE_DAYS);
    var cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ');

    // Permanently delete old soft-deleted people
    var oldPeople = queryAll("SELECT id FROM people WHERE deleted_at IS NOT NULL AND deleted_at < ?", [cutoffStr]);
    oldPeople.forEach(function(p) {
      db.run('DELETE FROM family_children WHERE child_id = ?', [p.id]);
      db.run('UPDATE families SET husband_id = NULL WHERE husband_id = ?', [p.id]);
      db.run('UPDATE families SET wife_id = NULL WHERE wife_id = ?', [p.id]);
      db.run('DELETE FROM people WHERE id = ?', [p.id]);
    });

    // Permanently delete old soft-deleted trees and their data
    var oldTrees = queryAll("SELECT id FROM trees WHERE deleted_at IS NOT NULL AND deleted_at < ?", [cutoffStr]);
    oldTrees.forEach(function(t) {
      db.run('DELETE FROM trees WHERE id = ?', [t.id]);
    });

    if (oldPeople.length > 0 || oldTrees.length > 0) {
      // Clean up orphan families
      db.run('DELETE FROM families WHERE husband_id IS NULL AND wife_id IS NULL AND id NOT IN (SELECT DISTINCT family_id FROM family_children)');
      saveDb();
      console.log('Purged', oldPeople.length, 'people and', oldTrees.length, 'trees older than', SOFT_DELETE_DAYS, 'days');
    }
  } catch (err) {
    console.error('Purge failed:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════════════════════════

async function initDatabase() {
  var SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    var fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run("CREATE TABLE IF NOT EXISTS trees (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), deleted_at TEXT DEFAULT NULL)");

  db.run("CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY AUTOINCREMENT, tree_id INTEGER NOT NULL, gedcom_id TEXT, name TEXT NOT NULL, sex TEXT, birth_date TEXT, death_date TEXT, is_adopted INTEGER DEFAULT 0, address TEXT, country TEXT, photo_path TEXT, created_at TEXT DEFAULT (datetime('now')), deleted_at TEXT DEFAULT NULL, FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE)");

  db.run("CREATE TABLE IF NOT EXISTS families (id INTEGER PRIMARY KEY AUTOINCREMENT, tree_id INTEGER NOT NULL, gedcom_id TEXT, husband_id INTEGER, wife_id INTEGER, status TEXT DEFAULT 'married', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE, FOREIGN KEY (husband_id) REFERENCES people(id) ON DELETE SET NULL, FOREIGN KEY (wife_id) REFERENCES people(id) ON DELETE SET NULL)");

  db.run("CREATE TABLE IF NOT EXISTS family_children (family_id INTEGER NOT NULL, child_id INTEGER NOT NULL, PRIMARY KEY (family_id, child_id), FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE, FOREIGN KEY (child_id) REFERENCES people(id) ON DELETE CASCADE)");

  // Extended person fields
  try { db.run('ALTER TABLE people ADD COLUMN burial_location TEXT DEFAULT NULL'); } catch(e) {}
  try { db.run('ALTER TABLE people ADD COLUMN notes TEXT DEFAULT NULL'); } catch(e) {}
  try { db.run('ALTER TABLE people ADD COLUMN occupation TEXT DEFAULT NULL'); } catch(e) {}
  try { db.run('ALTER TABLE people ADD COLUMN religion TEXT DEFAULT NULL'); } catch(e) {}
  try { db.run('ALTER TABLE people ADD COLUMN cause_of_death TEXT DEFAULT NULL'); } catch(e) {}
  try { db.run('ALTER TABLE people ADD COLUMN title TEXT DEFAULT NULL'); } catch(e) {}
  try { db.run('ALTER TABLE people ADD COLUMN suffix TEXT DEFAULT NULL'); } catch(e) {}

  // Extended family fields (marriage details)
  try { db.run('ALTER TABLE families ADD COLUMN marriage_date TEXT DEFAULT NULL'); } catch(e) {}
  try { db.run('ALTER TABLE families ADD COLUMN marriage_place TEXT DEFAULT NULL'); } catch(e) {}

  // Events table — life events for each person
  db.run("CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, person_id INTEGER NOT NULL, tree_id INTEGER NOT NULL, event_type TEXT NOT NULL, event_date TEXT, event_place TEXT, description TEXT, source_id INTEGER, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE, FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE, FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL)");

  // Sources table — where information came from
  db.run("CREATE TABLE IF NOT EXISTS sources (id INTEGER PRIMARY KEY AUTOINCREMENT, tree_id INTEGER NOT NULL, title TEXT NOT NULL, author TEXT, publication TEXT, repository TEXT, url TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE)");

  // Citations table — links a source to a specific fact
  db.run("CREATE TABLE IF NOT EXISTS citations (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER NOT NULL, record_type TEXT NOT NULL, record_id INTEGER NOT NULL, field_name TEXT, detail TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE)");

  // Attachments table — documents, photos, etc.
  db.run("CREATE TABLE IF NOT EXISTS attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, person_id INTEGER, tree_id INTEGER NOT NULL, file_type TEXT NOT NULL, display_name TEXT NOT NULL, description TEXT, file_path TEXT NOT NULL, original_filename TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE, FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE)");

  // Research log — per-person to-do / notes / findings
  db.run("CREATE TABLE IF NOT EXISTS research_log (id INTEGER PRIMARY KEY AUTOINCREMENT, person_id INTEGER NOT NULL, tree_id INTEGER NOT NULL, entry_type TEXT NOT NULL DEFAULT 'note', entry_text TEXT NOT NULL, entry_date TEXT DEFAULT (date('now')), is_done INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE, FOREIGN KEY (tree_id) REFERENCES trees(id) ON DELETE CASCADE)");

  db.run('CREATE INDEX IF NOT EXISTS idx_events_person ON events(person_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_tree ON events(tree_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sources_tree ON sources(tree_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_citations_source ON citations(source_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_citations_record ON citations(record_type, record_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_attachments_person ON attachments(person_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_attachments_tree ON attachments(tree_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_research_log_person ON research_log(person_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_research_log_tree ON research_log(tree_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_people_tree ON people(tree_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_people_deleted ON people(deleted_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_families_tree ON families(tree_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_families_husband ON families(husband_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_families_wife ON families(wife_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_fc_family ON family_children(family_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_fc_child ON family_children(child_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_trees_deleted ON trees(deleted_at)');

  // Migration: add deleted_at columns if they don't exist
  try { db.run('ALTER TABLE people ADD COLUMN deleted_at TEXT DEFAULT NULL'); } catch (e) { /* already exists */ }
  try { db.run('ALTER TABLE trees ADD COLUMN deleted_at TEXT DEFAULT NULL'); } catch (e) { /* already exists */ }

  // Migration: add pedi (pedigree linkage type) columns to family_children
  // Values: 'birth', 'step', 'adopted', 'foster', or null (unknown/default = birth)
  try { db.run('ALTER TABLE family_children ADD COLUMN pedi_husb TEXT DEFAULT NULL'); } catch(e) {}
  try { db.run('ALTER TABLE family_children ADD COLUMN pedi_wife TEXT DEFAULT NULL'); } catch(e) {}

  saveDb();

  // Purge old soft-deleted records on startup
  purgeSoftDeleted();

  // Start auto-backup
  startAutoBackup();
}

function saveDb() {
  var data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function queryAll(sql, params) {
  var stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  var rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params) {
  var rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function execute(sql, params) {
  db.run(sql, params || []);
  saveDb();
}

function lastInsertId() {
  return queryOne('SELECT last_insert_rowid() as id').id;
}

function createWindow() {
  var mainWindow = new BrowserWindow({
    width: 1280, height: 860,
    minWidth: 900, minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Inject Referer and User-Agent headers for OpenStreetMap tile requests
  // OSM requires a valid Referer for tile usage policy compliance
  var tileFilter = { urls: ['https://*.tile.openstreetmap.org/*', 'https://*.basemaps.cartocdn.com/*'] };
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(tileFilter, function(details, callback) {
    details.requestHeaders['Referer'] = 'https://family-tree-app.local/';
    details.requestHeaders['User-Agent'] = 'FamilyTreeApp/2.0 (Electron; genealogy desktop app)';
    callback({ requestHeaders: details.requestHeaders });
  });

  mainWindow.loadFile('index.html');
}

// ═══════════════════════════════════════════════════════════════════
// TREE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('get-trees', function() {
  var trees = queryAll('SELECT * FROM trees WHERE deleted_at IS NULL ORDER BY updated_at DESC');
  return trees.map(function(t) {
    var c = queryOne('SELECT COUNT(*) as count FROM people WHERE tree_id = ? AND deleted_at IS NULL', [t.id]);
    return Object.assign({}, t, { personCount: c.count });
  });
});

ipcMain.handle('get-deleted-trees', function() {
  return queryAll('SELECT * FROM trees WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
});

ipcMain.handle('create-tree', function(ev, name, description) {
  db.run('INSERT INTO trees (name, description) VALUES (?, ?)', [name, description || null]);
  var treeId = lastInsertId();
  saveDb();
  return queryOne('SELECT * FROM trees WHERE id = ?', [treeId]);
});

ipcMain.handle('update-tree', function(ev, id, name, description) {
  execute("UPDATE trees SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?", [name, description || null, id]);
  return queryOne('SELECT * FROM trees WHERE id = ?', [id]);
});

ipcMain.handle('delete-tree', function(ev, id) {
  createBackup('before-delete-tree');
  execute("UPDATE trees SET deleted_at = datetime('now') WHERE id = ?", [id]);
  // Soft-delete all people in this tree too
  execute("UPDATE people SET deleted_at = datetime('now') WHERE tree_id = ? AND deleted_at IS NULL", [id]);
  return true;
});

ipcMain.handle('restore-tree', function(ev, id) {
  execute('UPDATE trees SET deleted_at = NULL WHERE id = ?', [id]);
  // Restore all people in this tree
  execute('UPDATE people SET deleted_at = NULL WHERE tree_id = ?', [id]);
  return true;
});

ipcMain.handle('permanently-delete-tree', function(ev, id) {
  createBackup('before-permanent-delete');
  // Delete all family_children for families in this tree
  var fams = queryAll('SELECT id FROM families WHERE tree_id = ?', [id]);
  fams.forEach(function(f) {
    db.run('DELETE FROM family_children WHERE family_id = ?', [f.id]);
  });
  db.run('DELETE FROM families WHERE tree_id = ?', [id]);
  db.run('DELETE FROM people WHERE tree_id = ?', [id]);
  db.run('DELETE FROM trees WHERE id = ?', [id]);
  saveDb();
  return true;
});

// ═══════════════════════════════════════════════════════════════════
// PEOPLE CRUD
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('get-people', function(ev, treeId) {
  return queryAll('SELECT * FROM people WHERE tree_id = ? AND deleted_at IS NULL ORDER BY name', [treeId]);
});

ipcMain.handle('get-deleted-people', function(ev, treeId) {
  return queryAll('SELECT * FROM people WHERE tree_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC', [treeId]);
});

ipcMain.handle('add-person', function(ev, treeId, data) {
  db.run('INSERT INTO people (tree_id, gedcom_id, name, sex, birth_date, death_date, is_adopted, address, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [treeId, data.gedcomId || null, data.name, data.sex || null, data.birthDate || null,
     data.deathDate || null, data.isAdopted ? 1 : 0, data.address || null, data.country || null]);
  var personId = lastInsertId();
  db.run("UPDATE trees SET updated_at = datetime('now') WHERE id = ?", [treeId]);
  saveDb();
  return queryOne('SELECT * FROM people WHERE id = ?', [personId]);
});

ipcMain.handle('update-person', function(ev, id, fields) {
  var allowed = ['name','sex','birth_date','death_date','is_adopted','address','country','photo_path','gedcom_id','burial_location','notes','occupation','religion','cause_of_death','title','suffix'];
  var sets = [];
  var vals = [];
  for (var key in fields) {
    if (!fields.hasOwnProperty(key)) continue;
    var col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowed.indexOf(col) !== -1) {
      sets.push(col + ' = ?');
      var v = fields[key];
      vals.push(col === 'is_adopted' ? (v ? 1 : 0) : (v != null ? v : null));
    }
  }
  if (sets.length === 0) { console.log('update-person: no valid fields to update'); return null; }
  vals.push(id);
  try {
    db.run('UPDATE people SET ' + sets.join(', ') + ' WHERE id = ?', vals);
    saveDb();
  } catch(err) {
    console.error('update-person SQL error:', err, 'SQL:', 'UPDATE people SET ' + sets.join(', ') + ' WHERE id = ?', 'vals:', vals);
    throw err;
  }
  var person = queryOne('SELECT * FROM people WHERE id = ?', [id]);
  if (person) {
    try { execute("UPDATE trees SET updated_at = datetime('now') WHERE id = ?", [person.tree_id]); } catch(e) {}
  }
  return person;
});

ipcMain.handle('remove-person', function(ev, id) {
  createBackup('before-delete-person');
  // Soft delete
  execute("UPDATE people SET deleted_at = datetime('now') WHERE id = ?", [id]);
  // Remove from family links so tree view stays clean
  execute('DELETE FROM family_children WHERE child_id = ?', [id]);
  execute('UPDATE families SET husband_id = NULL WHERE husband_id = ?', [id]);
  execute('UPDATE families SET wife_id = NULL WHERE wife_id = ?', [id]);
  execute('DELETE FROM families WHERE husband_id IS NULL AND wife_id IS NULL AND id NOT IN (SELECT DISTINCT family_id FROM family_children)');
  var person = queryOne('SELECT * FROM people WHERE id = ?', [id]);
  if (person) execute("UPDATE trees SET updated_at = datetime('now') WHERE id = ?", [person.tree_id]);
  return true;
});

ipcMain.handle('restore-person', function(ev, id) {
  execute('UPDATE people SET deleted_at = NULL WHERE id = ?', [id]);
  var person = queryOne('SELECT * FROM people WHERE id = ?', [id]);
  if (person) execute("UPDATE trees SET updated_at = datetime('now') WHERE id = ?", [person.tree_id]);
  return true;
});

ipcMain.handle('permanently-delete-person', function(ev, id) {
  createBackup('before-permanent-delete');
  db.run('DELETE FROM family_children WHERE child_id = ?', [id]);
  db.run('UPDATE families SET husband_id = NULL WHERE husband_id = ?', [id]);
  db.run('UPDATE families SET wife_id = NULL WHERE wife_id = ?', [id]);
  db.run('DELETE FROM people WHERE id = ?', [id]);
  db.run('DELETE FROM families WHERE husband_id IS NULL AND wife_id IS NULL AND id NOT IN (SELECT DISTINCT family_id FROM family_children)');
  saveDb();
  return true;
});

// ═══════════════════════════════════════════════════════════════════
// FAMILIES CRUD
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('get-families', function(ev, treeId) {
  var fams = queryAll('SELECT * FROM families WHERE tree_id = ?', [treeId]);
  return fams.map(function(f) {
    var childRows = queryAll('SELECT child_id, pedi_husb, pedi_wife FROM family_children WHERE family_id = ?', [f.id]);
    return Object.assign({}, f, {
      childIds: childRows.map(function(r) { return r.child_id; }),
      childPedi: childRows.reduce(function(acc, r) {
        if (r.pedi_husb || r.pedi_wife) {
          acc[r.child_id] = { husb: r.pedi_husb || null, wife: r.pedi_wife || null };
        }
        return acc;
      }, {})
    });
  });
});

ipcMain.handle('add-family', function(ev, treeId, data) {
  db.run('INSERT INTO families (tree_id, gedcom_id, husband_id, wife_id, status, marriage_date, marriage_place) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [treeId, data.gedcomId || null, data.husbandId || null, data.wifeId || null, data.status || 'married', data.marriageDate || null, data.marriagePlace || null]);
  var famId = lastInsertId();
  (data.childIds || []).forEach(function(cid) {
    db.run('INSERT OR IGNORE INTO family_children (family_id, child_id) VALUES (?, ?)', [famId, cid]);
  });
  db.run("UPDATE trees SET updated_at = datetime('now') WHERE id = ?", [treeId]);
  saveDb();
  return { id: famId };
});

ipcMain.handle('update-family', function(ev, id, fields) {
  if (fields.status !== undefined) execute('UPDATE families SET status = ? WHERE id = ?', [fields.status, id]);
  if (fields.husbandId !== undefined) execute('UPDATE families SET husband_id = ? WHERE id = ?', [fields.husbandId, id]);
  if (fields.wifeId !== undefined) execute('UPDATE families SET wife_id = ? WHERE id = ?', [fields.wifeId, id]);
  if (fields.marriageDate !== undefined) execute('UPDATE families SET marriage_date = ? WHERE id = ?', [fields.marriageDate || null, id]);
  if (fields.marriagePlace !== undefined) execute('UPDATE families SET marriage_place = ? WHERE id = ?', [fields.marriagePlace || null, id]);
  if (fields.addChildId) execute('INSERT OR IGNORE INTO family_children (family_id, child_id) VALUES (?, ?)', [id, fields.addChildId]);
  var fam = queryOne('SELECT * FROM families WHERE id = ?', [id]);
  if (fam) execute("UPDATE trees SET updated_at = datetime('now') WHERE id = ?", [fam.tree_id]);
  return fam;
});

// Move a child from one family to another (or add to a new family)
ipcMain.handle('move-child', function(ev, childId, fromFamilyId, toFamilyId) {
  if (fromFamilyId) {
    db.run('DELETE FROM family_children WHERE family_id = ? AND child_id = ?', [fromFamilyId, childId]);
  }
  if (toFamilyId) {
    db.run('INSERT OR IGNORE INTO family_children (family_id, child_id) VALUES (?, ?)', [toFamilyId, childId]);
  }
  saveDb();
  return { success: true };
});

// Add a child to an additional family (second set of parents)
ipcMain.handle('add-child-to-family', function(ev, childId, familyId, pediHusb, pediWife) {
  db.run('INSERT OR IGNORE INTO family_children (family_id, child_id, pedi_husb, pedi_wife) VALUES (?, ?, ?, ?)',
    [familyId, childId, pediHusb || null, pediWife || null]);
  saveDb();
  return { success: true };
});

// Update the pedigree linkage type for a child in a family
ipcMain.handle('update-child-pedi', function(ev, childId, familyId, pediHusb, pediWife) {
  db.run('UPDATE family_children SET pedi_husb = ?, pedi_wife = ? WHERE family_id = ? AND child_id = ?',
    [pediHusb || null, pediWife || null, familyId, childId]);
  saveDb();
  return { success: true };
});

// ═══════════════════════════════════════════════════════════════════
// BACKUP MANAGEMENT (exposed to renderer)
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('get-backups', function() {
  try {
    var files = fs.readdirSync(backupsDir)
      .filter(function(f) { return f.startsWith('backup-') && f.endsWith('.sqlite'); })
      .map(function(f) {
        var stat = fs.statSync(path.join(backupsDir, f));
        return { name: f, size: stat.size, time: stat.mtimeMs, date: new Date(stat.mtimeMs).toLocaleString() };
      })
      .sort(function(a, b) { return b.time - a.time; });
    return files;
  } catch (err) {
    return [];
  }
});

ipcMain.handle('restore-backup', async function(ev, filename) {
  var backupPath = path.join(backupsDir, filename);
  if (!fs.existsSync(backupPath)) return false;

  // Create a safety backup of current state before restoring
  createBackup('before-restore');

  try {
    var SQL = await initSqlJs();
    var backupBuffer = fs.readFileSync(backupPath);
    var backupDb = new SQL.Database(backupBuffer);

    // Verify the backup is valid by running a simple query
    var test = backupDb.exec('SELECT COUNT(*) FROM trees');
    backupDb.close();

    // Replace current DB
    db.close();
    fs.copyFileSync(backupPath, dbPath);
    var fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    db.run('PRAGMA foreign_keys = ON');

    return true;
  } catch (err) {
    console.error('Restore failed:', err);
    return false;
  }
});

ipcMain.handle('create-manual-backup', function() {
  return createBackup('manual');
});

// ═══════════════════════════════════════════════════════════════════
// EVENTS (life events per person)
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('get-events', function(ev, personId) {
  return queryAll('SELECT * FROM events WHERE person_id = ? ORDER BY event_date ASC, id ASC', [personId]);
});

ipcMain.handle('add-event', function(ev, personId, treeId, data) {
  db.run('INSERT INTO events (person_id, tree_id, event_type, event_date, event_place, description, source_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [personId, treeId, data.eventType, data.eventDate || null, data.eventPlace || null, data.description || null, data.sourceId || null]);
  var id = lastInsertId();
  saveDb();
  return queryOne('SELECT * FROM events WHERE id = ?', [id]);
});

ipcMain.handle('update-event', function(ev, id, fields) {
  var allowed = ['event_type','event_date','event_place','description','source_id'];
  var sets = [];
  var vals = [];
  for (var key in fields) {
    if (!fields.hasOwnProperty(key)) continue;
    var col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowed.indexOf(col) !== -1) {
      sets.push(col + ' = ?');
      vals.push(fields[key] != null ? fields[key] : null);
    }
  }
  if (sets.length === 0) return null;
  vals.push(id);
  execute('UPDATE events SET ' + sets.join(', ') + ' WHERE id = ?', vals);
  return queryOne('SELECT * FROM events WHERE id = ?', [id]);
});

ipcMain.handle('remove-event', function(ev, id) {
  execute('DELETE FROM events WHERE id = ?', [id]);
  return true;
});

// ═══════════════════════════════════════════════════════════════════
// SOURCES
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('get-sources', function(ev, treeId) {
  return queryAll('SELECT * FROM sources WHERE tree_id = ? ORDER BY title ASC', [treeId]);
});

ipcMain.handle('add-source', function(ev, treeId, data) {
  db.run('INSERT INTO sources (tree_id, title, author, publication, repository, url, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [treeId, data.title, data.author || null, data.publication || null, data.repository || null, data.url || null, data.notes || null]);
  var id = lastInsertId();
  saveDb();
  return queryOne('SELECT * FROM sources WHERE id = ?', [id]);
});

ipcMain.handle('update-source', function(ev, id, fields) {
  var allowed = ['title','author','publication','repository','url','notes'];
  var sets = [];
  var vals = [];
  for (var key in fields) {
    if (!fields.hasOwnProperty(key)) continue;
    if (allowed.indexOf(key) !== -1) {
      sets.push(key + ' = ?');
      vals.push(fields[key] != null ? fields[key] : null);
    }
  }
  if (sets.length === 0) return null;
  vals.push(id);
  execute('UPDATE sources SET ' + sets.join(', ') + ' WHERE id = ?', vals);
  return queryOne('SELECT * FROM sources WHERE id = ?', [id]);
});

ipcMain.handle('remove-source', function(ev, id) {
  execute('DELETE FROM citations WHERE source_id = ?', [id]);
  execute('DELETE FROM sources WHERE id = ?', [id]);
  return true;
});

// ═══════════════════════════════════════════════════════════════════
// CITATIONS
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('get-citations', function(ev, recordType, recordId) {
  return queryAll(
    'SELECT c.*, s.title as source_title FROM citations c LEFT JOIN sources s ON c.source_id = s.id WHERE c.record_type = ? AND c.record_id = ? ORDER BY c.id',
    [recordType, recordId]
  );
});

ipcMain.handle('add-citation', function(ev, data) {
  db.run('INSERT INTO citations (source_id, record_type, record_id, field_name, detail) VALUES (?, ?, ?, ?, ?)',
    [data.sourceId, data.recordType, data.recordId, data.fieldName || null, data.detail || null]);
  var id = lastInsertId();
  saveDb();
  return queryOne('SELECT * FROM citations WHERE id = ?', [id]);
});

ipcMain.handle('remove-citation', function(ev, id) {
  execute('DELETE FROM citations WHERE id = ?', [id]);
  return true;
});

// ═══════════════════════════════════════════════════════════════════
// ATTACHMENTS
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('get-attachments', function(ev, personId) {
  return queryAll('SELECT * FROM attachments WHERE person_id = ? ORDER BY created_at DESC', [personId]);
});

ipcMain.handle('add-attachment', async function(ev, personId, treeId) {
  var result = await dialog.showOpenDialog({
    title: 'Select a file to attach',
    filters: [
      { name: 'All Supported', extensions: ['jpg','jpeg','png','gif','webp','bmp','pdf','doc','docx','txt','rtf'] },
      { name: 'Images', extensions: ['jpg','jpeg','png','gif','webp','bmp'] },
      { name: 'Documents', extensions: ['pdf','doc','docx','txt','rtf'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled || result.filePaths.length === 0) return [];

  var docsDir = path.join(userDataPath, 'documents', 'tree-' + treeId, 'person-' + personId);
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  var added = [];
  result.filePaths.forEach(function(srcPath) {
    var ext = path.extname(srcPath).toLowerCase();
    var originalName = path.basename(srcPath);
    var timestamp = Date.now();
    var destName = timestamp + '-' + originalName;
    var destPath = path.join(docsDir, destName);

    fs.copyFileSync(srcPath, destPath);

    var fileType = 'document';
    if (['.jpg','.jpeg','.png','.gif','.webp','.bmp'].indexOf(ext) !== -1) fileType = 'photo';
    else if (ext === '.pdf') fileType = 'pdf';

    db.run('INSERT INTO attachments (person_id, tree_id, file_type, display_name, file_path, original_filename) VALUES (?, ?, ?, ?, ?, ?)',
      [personId, treeId, fileType, originalName, destPath, originalName]);
    var id = lastInsertId();
    added.push(queryOne('SELECT * FROM attachments WHERE id = ?', [id]));
  });

  saveDb();
  return added;
});

ipcMain.handle('update-attachment', function(ev, id, fields) {
  if (fields.displayName !== undefined) execute('UPDATE attachments SET display_name = ? WHERE id = ?', [fields.displayName, id]);
  if (fields.description !== undefined) execute('UPDATE attachments SET description = ? WHERE id = ?', [fields.description, id]);
  return queryOne('SELECT * FROM attachments WHERE id = ?', [id]);
});

ipcMain.handle('remove-attachment', function(ev, id) {
  var att = queryOne('SELECT * FROM attachments WHERE id = ?', [id]);
  if (att && att.file_path && fs.existsSync(att.file_path)) {
    try { fs.unlinkSync(att.file_path); } catch(e) { console.error('Failed to delete file:', e); }
  }
  execute('DELETE FROM attachments WHERE id = ?', [id]);
  return true;
});

// ═══════════════════════════════════════════════════════════════════
// RESEARCH LOG
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('get-research-log', function(ev, personId) {
  return queryAll('SELECT * FROM research_log WHERE person_id = ? ORDER BY created_at DESC', [personId]);
});

ipcMain.handle('add-research-log', function(ev, personId, treeId, data) {
  db.run('INSERT INTO research_log (person_id, tree_id, entry_type, entry_text, entry_date) VALUES (?, ?, ?, ?, ?)',
    [personId, treeId, data.entryType || 'note', data.entryText, data.entryDate || new Date().toISOString().slice(0, 10)]);
  var id = lastInsertId();
  saveDb();
  return queryOne('SELECT * FROM research_log WHERE id = ?', [id]);
});

ipcMain.handle('update-research-log', function(ev, id, fields) {
  if (fields.isDone !== undefined) execute('UPDATE research_log SET is_done = ? WHERE id = ?', [fields.isDone ? 1 : 0, id]);
  if (fields.entryText !== undefined) execute('UPDATE research_log SET entry_text = ? WHERE id = ?', [fields.entryText, id]);
  if (fields.entryType !== undefined) execute('UPDATE research_log SET entry_type = ? WHERE id = ?', [fields.entryType, id]);
  return queryOne('SELECT * FROM research_log WHERE id = ?', [id]);
});

ipcMain.handle('remove-research-log', function(ev, id) {
  execute('DELETE FROM research_log WHERE id = ?', [id]);
  return true;
});

// ═══════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('search-people', function(ev, treeId, query) {
  var q = '%' + query + '%';
  // Search across person fields AND events (places, descriptions)
  return queryAll(
    'SELECT DISTINCT p.* FROM people p '
    + 'LEFT JOIN events e ON e.person_id = p.id '
    + 'WHERE p.tree_id = ? AND p.deleted_at IS NULL '
    + 'AND (p.name LIKE ? OR p.birth_date LIKE ? OR p.death_date LIKE ? '
    + 'OR p.address LIKE ? OR p.country LIKE ? OR p.notes LIKE ? '
    + 'OR p.occupation LIKE ? OR p.burial_location LIKE ? OR p.religion LIKE ? '
    + 'OR e.event_place LIKE ? OR e.description LIKE ? OR e.event_date LIKE ?) '
    + 'ORDER BY p.name',
    [treeId, q, q, q, q, q, q, q, q, q, q, q, q]
  );
});

// ═══════════════════════════════════════════════════════════════════
// GEDCOM IMPORT
// ═══════════════════════════════════════════════════════════════════

// --- Hierarchical GEDCOM parser ---
// Builds a proper tree of nodes so repeated tags (multiple RESI, EVEN, etc.)
// are all captured instead of being overwritten.

function parseGedcomLines(raw) {
  var lines = raw.split(/\r?\n/);
  // Each node: { level, pointer, tag, value, children[] }
  var root = { level: -1, tag: 'ROOT', value: '', children: [] };
  var stack = [root];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line.trim()) continue;
    var m = line.match(/^(\d+)\s+(@\S+@)?\s*(\S+)\s?(.*)?$/);
    if (!m) continue;
    var node = {
      level: parseInt(m[1]),
      pointer: m[2] || null,
      tag: m[3],
      value: (m[4] || '').trim(),
      children: []
    };

    // Pop stack until we find this node's parent (the nearest node with level < this one)
    while (stack.length > 1 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return root.children; // top-level (level 0) nodes
}

// Helpers for walking parsed GEDCOM nodes

function findChild(node, tag) {
  for (var i = 0; i < node.children.length; i++) {
    if (node.children[i].tag === tag) return node.children[i];
  }
  return null;
}

function findChildren(node, tag) {
  var out = [];
  for (var i = 0; i < node.children.length; i++) {
    if (node.children[i].tag === tag) out.push(node.children[i]);
  }
  return out;
}

function childValue(node, tag) {
  var c = findChild(node, tag);
  return c ? c.value : '';
}

// Collect NOTE / CONT / CONC into a single string
function collectText(node) {
  var text = node.value || '';
  for (var i = 0; i < node.children.length; i++) {
    var c = node.children[i];
    if (c.tag === 'CONT') text += '\n' + (c.value || '');
    else if (c.tag === 'CONC') text += (c.value || '');
  }
  return text.trim();
}

// Build a date string from a node that may have DATE + _DATE2 (range)
function collectDate(node) {
  var d = childValue(node, 'DATE');
  var d2 = childValue(node, '_DATE2');
  if (d && d2) return d + ' - ' + d2;
  return d || '';
}

// Build description from the node's own value plus any TYPE child
function collectEventDesc(node) {
  var parts = [];
  if (node.value) parts.push(node.value);
  var desc2 = childValue(node, '_Description2');
  if (desc2) parts.push(desc2);
  return parts.join(' — ').trim();
}

// Map GEDCOM tags to our event_type values
var GEDCOM_EVENT_MAP = {
  RESI: 'residence',
  EMIG: 'immigration',   // emigration treated as immigration type
  IMMI: 'immigration',
  NATU: 'naturalization',
  CENS: 'other',
  CHR:  'religious event',
  BAPM: 'religious event',
  EDUC: 'education',
  GRAD: 'education',
  PROP: 'other',
  RETI: 'other',
  WILL: 'other',
  ORDN: 'religious event',
  BAPL: 'religious event',
  ENDL: 'religious event',
  SLGC: 'religious event'
};

// Map the TYPE sub-value from EVEN records to our event_type
function mapEvenType(typeStr) {
  if (!typeStr) return 'other';
  var lower = typeStr.toLowerCase().trim();
  if (lower.indexOf('military') !== -1) return 'military service';
  if (lower.indexOf('employment') !== -1 || lower.indexOf('job') !== -1) return 'occupation';
  if (lower.indexOf('degree') !== -1 || lower.indexOf('education') !== -1) return 'education';
  if (lower.indexOf('funeral') !== -1) return 'other';
  if (lower.indexOf('medical') !== -1) return 'medical';
  if (lower.indexOf('religious') !== -1) return 'religious event';
  if (lower.indexOf('elected') !== -1 || lower.indexOf('office') !== -1) return 'elected office';
  if (lower.indexOf('court') !== -1) return 'court case';
  if (lower.indexOf('travel') !== -1) return 'travel';
  return 'other';
}

ipcMain.handle('import-gedcom', async function(ev, treeId) {
  var result = await dialog.showOpenDialog({
    title: 'Select a GEDCOM file',
    filters: [{ name: 'GEDCOM Files', extensions: ['ged'] }, { name: 'All Files', extensions: ['*'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return { individuals: 0, families: 0, canceled: true };

  createBackup('before-import');

  try {
    var raw = fs.readFileSync(result.filePaths[0], 'utf8');
    var topNodes = parseGedcomLines(raw);

    // Separate record types by their level-0 tag
    var indiNodes = [];
    var famNodes = [];
    var sourNodes = [];
    var objeNodes = [];

    for (var i = 0; i < topNodes.length; i++) {
      var n = topNodes[i];
      if (n.tag === 'INDI') indiNodes.push(n);
      else if (n.tag === 'FAM') famNodes.push(n);
      else if (n.tag === 'SOUR') sourNodes.push(n);
      else if (n.tag === 'OBJE') objeNodes.push(n);
    }

    // ── Phase 1: Import sources ──────────────────────────────────
    var gedcomToSourceId = {};
    var sourceCount = 0;

    for (var si = 0; si < sourNodes.length; si++) {
      var sn = sourNodes[si];
      var sTitle = childValue(sn, 'TITL') || childValue(sn, 'ABBR') || ('Source ' + (si + 1));
      var sAuthor = childValue(sn, 'AUTH') || null;
      var sPubl = childValue(sn, 'PUBL') || null;
      var sRepo = childValue(sn, 'CALN') || null;  // call number as repository ref
      var sType = childValue(sn, '_TYPE');
      var sNotes = '';
      if (sType) sNotes = 'Type: ' + sType;
      var noteNode = findChild(sn, 'NOTE');
      if (noteNode) {
        var noteText = collectText(noteNode);
        if (noteText) sNotes = sNotes ? sNotes + '\n' + noteText : noteText;
      }
      // Collect any TEXT data
      var dataNode = findChild(sn, 'DATA');
      if (dataNode) {
        var textNodes = findChildren(dataNode, 'TEXT');
        for (var ti = 0; ti < textNodes.length; ti++) {
          var txt = collectText(textNodes[ti]);
          if (txt) sNotes = sNotes ? sNotes + '\n' + txt : txt;
        }
      }

      db.run('INSERT INTO sources (tree_id, title, author, publication, repository, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [treeId, sTitle, sAuthor, sPubl, sRepo, sNotes || null]);
      gedcomToSourceId[sn.pointer] = lastInsertId();
      sourceCount++;
    }

    // ── Phase 2: Import individuals ──────────────────────────────
    var gedcomToPersonId = {};
    var pediMap = {};  // famPointer -> { childPointer -> { husb: 'step'|'birth', wife: 'step'|'birth' } }
    var indiCount = 0;
    var eventCount = 0;
    var citationCount = 0;

    for (var ii = 0; ii < indiNodes.length; ii++) {
      var ind = indiNodes[ii];

      // --- Name ---
      var nameNode = findChild(ind, 'NAME');
      var rawName = nameNode ? (nameNode.value || 'Unknown') : 'Unknown';
      rawName = rawName.replace(/\//g, '').trim();
      var nickname = nameNode ? childValue(nameNode, 'NICK') : '';
      var suffix = nameNode ? childValue(nameNode, 'NSFX') : '';
      var prefix = nameNode ? childValue(nameNode, 'NPFX') : '';

      // --- Sex ---
      var sex = childValue(ind, 'SEX') || null;

      // --- Birth ---
      var birthNode = findChild(ind, 'BIRT');
      var birthDate = birthNode ? childValue(birthNode, 'DATE') : null;
      var birthPlace = birthNode ? childValue(birthNode, 'PLAC') : '';

      // --- Death ---
      var deathNode = findChild(ind, 'DEAT');
      var deathDate = deathNode ? childValue(deathNode, 'DATE') : null;
      var causeOfDeath = deathNode ? childValue(deathNode, 'CAUS') : null;

      // --- Burial ---
      var buriNode = findChild(ind, 'BURI');
      var burialLocation = buriNode ? childValue(buriNode, 'PLAC') : null;

      // --- Occupation (first OCCU as the person-level field) ---
      var occuNode = findChild(ind, 'OCCU');
      var occupation = occuNode ? (occuNode.value || childValue(occuNode, 'PLAC') || null) : null;

      // --- Religion ---
      var reliNode = findChild(ind, 'RELI');
      var religion = reliNode ? (childValue(reliNode, 'PLAC') || reliNode.value || null) : null;

      // --- Physical description ---
      var dscrNode = findChild(ind, 'DSCR');
      var description = dscrNode ? collectText(dscrNode) : '';

      // --- Notes (all NOTE children concatenated) ---
      var noteNodes = findChildren(ind, 'NOTE');
      var allNotes = [];
      if (nickname) allNotes.push('Nickname: ' + nickname);
      if (prefix) allNotes.push('Prefix: ' + prefix);
      if (description) allNotes.push('Description: ' + description);
      for (var ni = 0; ni < noteNodes.length; ni++) {
        var nt = collectText(noteNodes[ni]);
        if (nt) allNotes.push(nt);
      }
      var notesStr = allNotes.length > 0 ? allNotes.join('\n\n') : null;

      // --- Country from birth place ---
      var personCountry = null;
      if (birthPlace) {
        var placeParts = birthPlace.split(',');
        personCountry = placeParts[placeParts.length - 1].trim() || null;
      }

      // --- Adopted? Check FAMC children for PEDI adopted ---
      // Also collect per-parent pedigree type (_HUSB step, _WIFE birth, etc.)
      var isAdopted = 0;
      var famcNodes = findChildren(ind, 'FAMC');
      for (var fi = 0; fi < famcNodes.length; fi++) {
        var pediNode = findChild(famcNodes[fi], 'PEDI');
        var pediVal = pediNode ? pediNode.value : '';
        if (pediVal && pediVal.toLowerCase() === 'adopted') { isAdopted = 1; }

        // Store per-parent relationship type: _HUSB and _WIFE sub-tags on PEDI
        var famcPointer = famcNodes[fi].value; // e.g. @F11@
        if (famcPointer && pediNode) {
          var husbPedi = childValue(pediNode, '_HUSB') || null;  // 'birth', 'step', etc.
          var wifePedi = childValue(pediNode, '_WIFE') || null;
          if (husbPedi || wifePedi) {
            if (!pediMap[famcPointer]) pediMap[famcPointer] = {};
            pediMap[famcPointer][ind.pointer] = {
              husb: husbPedi ? husbPedi.toLowerCase() : null,
              wife: wifePedi ? wifePedi.toLowerCase() : null
            };
          }
        }
      }

      // --- Insert person ---
      db.run('INSERT INTO people (tree_id, gedcom_id, name, sex, birth_date, death_date, is_adopted, address, country, burial_location, notes, occupation, religion, cause_of_death, title, suffix) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [treeId, ind.pointer, rawName, sex, birthDate || null, deathDate || null, isAdopted,
         birthPlace || null, personCountry, burialLocation, notesStr, occupation, religion,
         causeOfDeath, prefix || null, suffix || null]);
      var personId = lastInsertId();
      gedcomToPersonId[ind.pointer] = personId;
      indiCount++;

      // --- Helper to insert an event for this person ---
      function insertEvent(eventType, date, place, desc) {
        db.run('INSERT INTO events (person_id, tree_id, event_type, event_date, event_place, description) VALUES (?, ?, ?, ?, ?, ?)',
          [personId, treeId, eventType, date || null, place || null, desc || null]);
        eventCount++;
        return lastInsertId();
      }

      // --- Helper to insert an inline citation ---
      function insertCitation(sourcePointer, recordType, recordId, fieldName, page, quay) {
        var srcId = gedcomToSourceId[sourcePointer];
        if (!srcId) return;
        var detail = '';
        if (page) detail += 'Page: ' + page;
        if (quay) detail += (detail ? '; ' : '') + 'Quality: ' + quay;
        db.run('INSERT INTO citations (source_id, record_type, record_id, field_name, detail) VALUES (?, ?, ?, ?, ?)',
          [srcId, recordType, recordId, fieldName || null, detail || null]);
        citationCount++;
      }

      // --- Process inline SOUR citations on birth ---
      if (birthNode) {
        var birthSources = findChildren(birthNode, 'SOUR');
        for (var bs = 0; bs < birthSources.length; bs++) {
          insertCitation(birthSources[bs].value, 'person', personId, 'birth',
            childValue(birthSources[bs], 'PAGE'), childValue(birthSources[bs], 'QUAY'));
        }
      }

      // --- Process inline SOUR citations on death ---
      if (deathNode) {
        var deathSources = findChildren(deathNode, 'SOUR');
        for (var ds = 0; ds < deathSources.length; ds++) {
          insertCitation(deathSources[ds].value, 'person', personId, 'death',
            childValue(deathSources[ds], 'PAGE'), childValue(deathSources[ds], 'QUAY'));
        }
      }

      // --- Process inline SOUR citations on burial ---
      if (buriNode) {
        var buriSources = findChildren(buriNode, 'SOUR');
        for (var brs = 0; brs < buriSources.length; brs++) {
          insertCitation(buriSources[brs].value, 'person', personId, 'burial',
            childValue(buriSources[brs], 'PAGE'), childValue(buriSources[brs], 'QUAY'));
        }
      }

      // --- Top-level person SOUR citations ---
      var personSources = findChildren(ind, 'SOUR');
      for (var ps = 0; ps < personSources.length; ps++) {
        insertCitation(personSources[ps].value, 'person', personId, 'general',
          childValue(personSources[ps], 'PAGE'), childValue(personSources[ps], 'QUAY'));
      }

      // --- Events: RESI (multiple) ---
      var resiNodes = findChildren(ind, 'RESI');
      for (var ri = 0; ri < resiNodes.length; ri++) {
        var rn = resiNodes[ri];
        var rDate = collectDate(rn);
        var rPlace = childValue(rn, 'PLAC') || '';
        var rDesc = rn.value || '';  // descriptive text in the tag value itself
        insertEvent('residence', rDate, rPlace, rDesc);
        // Inline SOUR on residence
        var resiSources = findChildren(rn, 'SOUR');
        for (var rs = 0; rs < resiSources.length; rs++) {
          insertCitation(resiSources[rs].value, 'event', eventCount, 'residence',
            childValue(resiSources[rs], 'PAGE'), childValue(resiSources[rs], 'QUAY'));
        }
      }

      // --- Events: EVEN with TYPE ---
      var evenNodes = findChildren(ind, 'EVEN');
      for (var ei = 0; ei < evenNodes.length; ei++) {
        var en = evenNodes[ei];
        var eTypeRaw = childValue(en, 'TYPE');
        var eType = mapEvenType(eTypeRaw);
        var eDate = collectDate(en);
        var ePlace = childValue(en, 'PLAC') || '';
        var eDesc = en.value || '';
        if (eTypeRaw && eDesc) eDesc = eTypeRaw + ': ' + eDesc;
        else if (eTypeRaw) eDesc = eTypeRaw;
        var eDesc2 = childValue(en, '_Description2');
        if (eDesc2) eDesc = eDesc ? eDesc + ' — ' + eDesc2 : eDesc2;
        insertEvent(eType, eDate, ePlace, eDesc);
        // Inline SOUR on event
        var evenSources = findChildren(en, 'SOUR');
        for (var es = 0; es < evenSources.length; es++) {
          insertCitation(evenSources[es].value, 'event', eventCount, eType,
            childValue(evenSources[es], 'PAGE'), childValue(evenSources[es], 'QUAY'));
        }
      }

      // --- Events: EMIG, IMMI, NATU, CENS, CHR, BAPM, EDUC, GRAD, PROP, ORDN, RETI, WILL ---
      var eventTags = ['EMIG', 'IMMI', 'NATU', 'CENS', 'CHR', 'BAPM', 'EDUC', 'GRAD', 'PROP', 'ORDN', 'RETI', 'WILL'];
      for (var eti = 0; eti < eventTags.length; eti++) {
        var etag = eventTags[eti];
        var etNodes = findChildren(ind, etag);
        for (var eni = 0; eni < etNodes.length; eni++) {
          var etn = etNodes[eni];
          var etDate = collectDate(etn);
          var etPlace = childValue(etn, 'PLAC') || '';
          var etDesc = etn.value || '';
          var etType = GEDCOM_EVENT_MAP[etag] || 'other';
          // Add tag name context to description for clarity
          var tagLabel = etag.charAt(0) + etag.slice(1).toLowerCase();
          if (etag === 'EMIG') tagLabel = 'Emigration';
          else if (etag === 'IMMI') tagLabel = 'Immigration';
          else if (etag === 'NATU') tagLabel = 'Naturalization';
          else if (etag === 'CENS') tagLabel = 'Census';
          else if (etag === 'CHR') tagLabel = 'Christening';
          else if (etag === 'BAPM') tagLabel = 'Baptism';
          else if (etag === 'EDUC') tagLabel = 'Education';
          else if (etag === 'GRAD') tagLabel = 'Graduation';
          else if (etag === 'PROP') tagLabel = 'Property';
          else if (etag === 'ORDN') tagLabel = 'Ordination';
          else if (etag === 'RETI') tagLabel = 'Retirement';
          else if (etag === 'WILL') tagLabel = 'Will';
          if (etDesc) etDesc = tagLabel + ': ' + etDesc;
          else etDesc = tagLabel;
          insertEvent(etType, etDate, etPlace, etDesc);
          // Inline SOUR
          var etSources = findChildren(etn, 'SOUR');
          for (var ets = 0; ets < etSources.length; ets++) {
            insertCitation(etSources[ets].value, 'event', eventCount, etType,
              childValue(etSources[ets], 'PAGE'), childValue(etSources[ets], 'QUAY'));
          }
        }
      }

      // --- Additional OCCU entries as events (skip the first, already stored on person) ---
      var allOccu = findChildren(ind, 'OCCU');
      for (var oi = 0; oi < allOccu.length; oi++) {
        var oNode = allOccu[oi];
        var oDate = collectDate(oNode);
        var oPlace = childValue(oNode, 'PLAC') || '';
        var oDesc = oNode.value || '';
        // Always create an event, even for the first one (person.occupation stores it too)
        if (oDate || oPlace || oi > 0) {
          insertEvent('occupation', oDate, oPlace, oDesc);
        }
      }
    }

    // ── Phase 3: Import families ─────────────────────────────────
    var famCount = 0;

    for (var fk = 0; fk < famNodes.length; fk++) {
      var fn = famNodes[fk];
      var husbPointer = childValue(fn, 'HUSB');
      var wifePointer = childValue(fn, 'WIFE');
      var hId = gedcomToPersonId[husbPointer] || null;
      var wId = gedcomToPersonId[wifePointer] || null;

      var hasDivorce = !!findChild(fn, 'DIV');
      var marrNode = findChild(fn, 'MARR');
      var marrDate = marrNode ? childValue(marrNode, 'DATE') : null;
      var marrPlace = marrNode ? childValue(marrNode, 'PLAC') : null;

      db.run('INSERT INTO families (tree_id, gedcom_id, husband_id, wife_id, status, marriage_date, marriage_place) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [treeId, fn.pointer, hId, wId, hasDivorce ? 'divorced' : 'married', marrDate || null, marrPlace || null]);
      var famId = lastInsertId();

      var chilNodes = findChildren(fn, 'CHIL');
      for (var ci = 0; ci < chilNodes.length; ci++) {
        var childPointer = chilNodes[ci].value;
        var childId = gedcomToPersonId[childPointer];
        if (childId) {
          var pediInfo = (pediMap[fn.pointer] && pediMap[fn.pointer][childPointer]) || {};
          db.run('INSERT OR IGNORE INTO family_children (family_id, child_id, pedi_husb, pedi_wife) VALUES (?, ?, ?, ?)',
            [famId, childId, pediInfo.husb || null, pediInfo.wife || null]);
        }
      }
      famCount++;
    }

    db.run("UPDATE trees SET updated_at = datetime('now') WHERE id = ?", [treeId]);
    saveDb();

    console.log('GEDCOM import complete: ' + indiCount + ' individuals, ' + famCount + ' families, '
      + sourceCount + ' sources, ' + eventCount + ' events, ' + citationCount + ' citations');

    return {
      individuals: indiCount,
      families: famCount,
      sources: sourceCount,
      events: eventCount,
      citations: citationCount,
      canceled: false
    };
  } catch (err) {
    console.error('GEDCOM import error:', err);
    throw err;
  }
});

// ═══════════════════════════════════════════════════════════════════
// GEDCOM EXPORT
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('export-gedcom', async function(ev, treeId) {
  var result = await dialog.showSaveDialog({
    title: 'Export as GEDCOM', defaultPath: 'family-tree.ged',
    filters: [{ name: 'GEDCOM Files', extensions: ['ged'] }]
  });
  if (result.canceled || !result.filePath) return null;

  try {
    var people = queryAll('SELECT * FROM people WHERE tree_id = ? AND deleted_at IS NULL', [treeId]);
    var families = queryAll('SELECT * FROM families WHERE tree_id = ?', [treeId]);
    var sources = queryAll('SELECT * FROM sources WHERE tree_id = ?', [treeId]);

    var personGid = {};
    var famGid = {};
    var sourceGid = {};
    var ic = 1, fc = 1, sc = 1;
    people.forEach(function(p) { personGid[p.id] = p.gedcom_id || ('@I' + ic++ + '@'); });
    families.forEach(function(f) { famGid[f.id] = f.gedcom_id || ('@F' + fc++ + '@'); });
    sources.forEach(function(s) { sourceGid[s.id] = '@S' + sc++ + '@'; });

    var out = ['0 HEAD', '1 SOUR FamilyTreeApp', '2 NAME Family Tree', '2 VERS 2.0',
      '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];

    // Helper: write CONT lines for multi-line text at given level
    function writeContLines(text, level) {
      var lines = text.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (i === 0) continue; // first line already written by caller
        out.push(level + ' CONT ' + lines[i]);
      }
    }

    people.forEach(function(p) {
      var gid = personGid[p.id];
      out.push('0 ' + gid + ' INDI');
      if (p.name) {
        var parts = p.name.trim().split(/\s+/);
        var gedName = parts.length > 1 ? parts.slice(0, -1).join(' ') + ' /' + parts.slice(-1)[0] + '/' : p.name + ' //';
        out.push('1 NAME ' + gedName);
        if (p.suffix) out.push('2 NSFX ' + p.suffix);
        if (p.title) out.push('2 NPFX ' + p.title);
      }
      if (p.sex) out.push('1 SEX ' + p.sex);

      // Birth
      if (p.birth_date || p.address) {
        out.push('1 BIRT');
        if (p.birth_date) out.push('2 DATE ' + p.birth_date);
        if (p.address) out.push('2 PLAC ' + p.address);
      }

      // Death
      if (p.death_date || p.cause_of_death) {
        out.push('1 DEAT');
        if (p.death_date) out.push('2 DATE ' + p.death_date);
        if (p.cause_of_death) out.push('2 CAUS ' + p.cause_of_death);
      }

      // Burial
      if (p.burial_location) {
        out.push('1 BURI');
        out.push('2 PLAC ' + p.burial_location);
      }

      // Occupation
      if (p.occupation) {
        out.push('1 OCCU ' + p.occupation);
      }

      // Religion
      if (p.religion) {
        out.push('1 RELI');
        out.push('2 PLAC ' + p.religion);
      }

      // Notes
      if (p.notes) {
        var noteLines = p.notes.split('\n');
        out.push('1 NOTE ' + noteLines[0]);
        writeContLines(p.notes, 2);
      }

      // Events
      var events = queryAll('SELECT * FROM events WHERE person_id = ? ORDER BY event_date ASC, id ASC', [p.id]);
      events.forEach(function(ev) {
        if (ev.event_type === 'residence') {
          out.push('1 RESI' + (ev.description ? ' ' + ev.description : ''));
          if (ev.event_date) out.push('2 DATE ' + ev.event_date);
          if (ev.event_place) out.push('2 PLAC ' + ev.event_place);
        } else if (ev.event_type === 'immigration') {
          out.push('1 IMMI');
          if (ev.event_date) out.push('2 DATE ' + ev.event_date);
          if (ev.event_place) out.push('2 PLAC ' + ev.event_place);
        } else if (ev.event_type === 'naturalization') {
          out.push('1 NATU');
          if (ev.event_date) out.push('2 DATE ' + ev.event_date);
          if (ev.event_place) out.push('2 PLAC ' + ev.event_place);
        } else if (ev.event_type === 'education') {
          out.push('1 EDUC' + (ev.description ? ' ' + ev.description : ''));
          if (ev.event_date) out.push('2 DATE ' + ev.event_date);
          if (ev.event_place) out.push('2 PLAC ' + ev.event_place);
        } else {
          // Generic EVEN with TYPE
          out.push('1 EVEN' + (ev.description ? ' ' + ev.description : ''));
          out.push('2 TYPE ' + (ev.event_type || 'other'));
          if (ev.event_date) out.push('2 DATE ' + ev.event_date);
          if (ev.event_place) out.push('2 PLAC ' + ev.event_place);
        }
      });

      // Family links
      families.forEach(function(f) {
        if (f.husband_id === p.id || f.wife_id === p.id) out.push('1 FAMS ' + famGid[f.id]);
      });
      families.forEach(function(f) {
        var childRow = queryOne('SELECT * FROM family_children WHERE family_id = ? AND child_id = ?', [f.id, p.id]);
        if (childRow) {
          out.push('1 FAMC ' + famGid[f.id]);
          if (p.is_adopted) {
            out.push('2 PEDI adopted');
          } else if (childRow.pedi_husb || childRow.pedi_wife) {
            out.push('2 PEDI birth');
            if (childRow.pedi_husb) out.push('3 _HUSB ' + childRow.pedi_husb);
            if (childRow.pedi_wife) out.push('3 _WIFE ' + childRow.pedi_wife);
          }
        }
      });
    });

    families.forEach(function(f) {
      out.push('0 ' + famGid[f.id] + ' FAM');
      if (f.husband_id) out.push('1 HUSB ' + personGid[f.husband_id]);
      if (f.wife_id) out.push('1 WIFE ' + personGid[f.wife_id]);
      if (f.marriage_date || f.marriage_place) {
        out.push('1 MARR');
        if (f.marriage_date) out.push('2 DATE ' + f.marriage_date);
        if (f.marriage_place) out.push('2 PLAC ' + f.marriage_place);
      }
      var kids = queryAll('SELECT child_id FROM family_children WHERE family_id = ?', [f.id]);
      kids.forEach(function(k) { out.push('1 CHIL ' + personGid[k.child_id]); });
      if (f.status === 'divorced') { out.push('1 DIV'); out.push('2 DATE'); }
    });

    // Sources
    sources.forEach(function(s) {
      var sgid = sourceGid[s.id];
      out.push('0 ' + sgid + ' SOUR');
      if (s.title) out.push('1 TITL ' + s.title);
      if (s.author) out.push('1 AUTH ' + s.author);
      if (s.publication) out.push('1 PUBL ' + s.publication);
      if (s.repository) out.push('1 CALN ' + s.repository);
      if (s.notes) {
        var snLines = s.notes.split('\n');
        out.push('1 NOTE ' + snLines[0]);
        writeContLines(s.notes, 2);
      }
    });

    out.push('0 TRLR');
    fs.writeFileSync(result.filePath, out.join('\n'), 'utf8');
    return result.filePath;
  } catch (err) {
    console.error('GEDCOM export failed:', err);
    throw err;
  }
});

// ═══════════════════════════════════════════════════════════════════
// PHOTO PICKER
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('pick-photo', async function(ev, personId) {
  var result = await dialog.showOpenDialog({
    title: 'Select a photo',
    filters: [{ name: 'Images', extensions: ['jpg','jpeg','png','gif','webp','bmp'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  var ext = path.extname(result.filePaths[0]);
  var destPath = path.join(photosDir, personId + ext);
  fs.copyFileSync(result.filePaths[0], destPath);
  execute('UPDATE people SET photo_path = ? WHERE id = ?', [destPath, personId]);
  return destPath;
});

// ═══════════════════════════════════════════════════════════════════
// PRINT TO PDF
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('print-to-pdf', async function() {
  var win = BrowserWindow.getFocusedWindow();
  if (!win) return null;
  var result = await dialog.showSaveDialog(win, {
    title: 'Save as PDF', defaultPath: 'family-tree.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return null;
  var pdfData = await win.webContents.printToPDF({
    landscape: true, printBackground: true,
    margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
  });
  fs.writeFileSync(result.filePath, pdfData);
  return result.filePath;
});

ipcMain.handle('print-to-printer', async function() {
  var win = BrowserWindow.getFocusedWindow();
  if (!win) return false;
  win.webContents.print({
    silent: false,
    printBackground: true,
    landscape: true
  });
  return true;
});

ipcMain.handle('save-report', async function(ev, htmlContent) {
  var win = BrowserWindow.getFocusedWindow();
  if (!win) return null;

  var result = await dialog.showSaveDialog(win, {
    title: 'Save Family Report',
    defaultPath: 'family-report.pdf',
    filters: [
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'HTML', extensions: ['html'] }
    ]
  });

  if (result.canceled || !result.filePath) return null;

  var ext = path.extname(result.filePath).toLowerCase();

  if (ext === '.html') {
    fs.writeFileSync(result.filePath, htmlContent, 'utf8');
    return result.filePath;
  }

  // For PDF, create a hidden window, load the HTML, and print to PDF
  var reportWin = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  // Write HTML to a temp file
  var tempPath = path.join(userDataPath, 'temp-report.html');
  fs.writeFileSync(tempPath, htmlContent, 'utf8');
  await reportWin.loadFile(tempPath);

  // Wait a moment for rendering
  await new Promise(function(resolve) { setTimeout(resolve, 500); });

  var pdfData = await reportWin.webContents.printToPDF({
    landscape: false,
    printBackground: true,
    margins: { marginType: 'custom', top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }
  });

  fs.writeFileSync(result.filePath, pdfData);
  reportWin.close();

  // Clean up temp file
  try { fs.unlinkSync(tempPath); } catch(e) {}

  return result.filePath;
});

ipcMain.handle('print-report', async function(ev, htmlContent) {
  // Create a hidden window, load the report HTML, and send to printer
  var reportWin = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  var tempPath = path.join(userDataPath, 'temp-report-print.html');
  fs.writeFileSync(tempPath, htmlContent, 'utf8');
  await reportWin.loadFile(tempPath);

  // Wait for rendering
  await new Promise(function(resolve) { setTimeout(resolve, 500); });

  reportWin.webContents.print({
    silent: false,
    printBackground: true,
    landscape: false
  }, function(success, failureReason) {
    if (!success && failureReason) console.error('Print failed:', failureReason);
    reportWin.close();
    try { fs.unlinkSync(tempPath); } catch(e) {}
  });

  return true;
});

// ═══════════════════════════════════════════════════════════════════
// BUG REPORTING (GitHub Issues)
// ═══════════════════════════════════════════════════════════════════

var GITHUB_REPO = 'alosdiallo/My_Family_Tree_Desktop_Application';
// Generate a fine-grained token at https://github.com/settings/tokens
// with Issues read/write permission scoped to the repo above.
var GITHUB_TOKEN = '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';

ipcMain.handle('get-system-info', function() {
  var info = {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    os: process.platform + ' ' + process.arch,
    osVersion: require('os').release()
  };
  // Add tree stats if DB is open
  if (db) {
    try {
      var treeCount = queryOne('SELECT COUNT(*) as c FROM trees WHERE deleted_at IS NULL');
      var peopleCount = queryOne('SELECT COUNT(*) as c FROM people WHERE deleted_at IS NULL');
      var familyCount = queryOne('SELECT COUNT(*) as c FROM families');
      info.trees = treeCount ? treeCount.c : 0;
      info.people = peopleCount ? peopleCount.c : 0;
      info.families = familyCount ? familyCount.c : 0;
    } catch(e) {}
  }
  return info;
});

ipcMain.handle('submit-bug-report', async function(ev, data) {
  var https = require('https');

  var labels = ['bug'];
  if (data.severity === 'crash') labels.push('critical');

  var body = '## What happened\n' + (data.description || 'No description provided.') + '\n\n';
  if (data.steps) body += '## Steps to reproduce\n' + data.steps + '\n\n';
  if (data.expected) body += '## What I expected\n' + data.expected + '\n\n';
  body += '## System Info\n';
  body += '| | |\n|---|---|\n';
  body += '| App Version | ' + (data.systemInfo.appVersion || '?') + ' |\n';
  body += '| Electron | ' + (data.systemInfo.electronVersion || '?') + ' |\n';
  body += '| OS | ' + (data.systemInfo.os || '?') + ' ' + (data.systemInfo.osVersion || '') + ' |\n';
  body += '| Trees | ' + (data.systemInfo.trees || 0) + ' |\n';
  body += '| People | ' + (data.systemInfo.people || 0) + ' |\n';
  body += '| Families | ' + (data.systemInfo.families || 0) + ' |\n';
  if (data.currentView) body += '| View | ' + data.currentView + ' |\n';

  var payload = JSON.stringify({
    title: '[Bug Report] ' + (data.title || 'Issue from app'),
    body: body,
    labels: labels
  });

  return new Promise(function(resolve, reject) {
    var req = https.request({
      hostname: 'api.github.com',
      path: '/repos/' + GITHUB_REPO + '/issues',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GITHUB_TOKEN,
        'User-Agent': 'FamilyTreeApp/' + app.getVersion(),
        'Accept': 'application/vnd.github+json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, function(res) {
      var responseData = '';
      res.on('data', function(chunk) { responseData += chunk; });
      res.on('end', function() {
        try {
          var parsed = JSON.parse(responseData);
          if (res.statusCode === 201) {
            resolve({ success: true, url: parsed.html_url, number: parsed.number });
          } else {
            console.error('GitHub API error:', res.statusCode, responseData);
            resolve({ success: false, error: parsed.message || 'GitHub API error (' + res.statusCode + ')' });
          }
        } catch(e) {
          resolve({ success: false, error: 'Failed to parse GitHub response' });
        }
      });
    });

    req.on('error', function(err) {
      console.error('Bug report network error:', err);
      resolve({ success: false, error: 'Network error — are you connected to the internet?' });
    });

    req.write(payload);
    req.end();
  });
});

// ═══════════════════════════════════════════════════════════════════
// HOT-SWAP AUTO-UPDATER (GitHub)
// ═══════════════════════════════════════════════════════════════════

var UPDATE_REPO = 'alosdiallo/My_Family_Tree_Desktop_Application';
var UPDATE_BRANCH = 'main';
// Files that get replaced during an update
var UPDATABLE_FILES = [
  'main.js', 'renderer.js', 'preload.js', 'index.html', 'styles.css',
  'date-parser.js', 'country-data.js', 'world-map.js', 'package.json'
];

ipcMain.handle('check-for-update', async function() {
  var https = require('https');

  // Fetch the remote package.json to compare versions
  return new Promise(function(resolve) {
    var req = https.request({
      hostname: 'raw.githubusercontent.com',
      path: '/' + UPDATE_REPO + '/' + UPDATE_BRANCH + '/package.json',
      method: 'GET',
      headers: { 'User-Agent': 'FamilyTreeApp/' + app.getVersion() }
    }, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          var remote = JSON.parse(data);
          var localVersion = app.getVersion();
          var remoteVersion = remote.version || '0.0.0';
          var hasUpdate = compareVersions(remoteVersion, localVersion) > 0;
          resolve({
            hasUpdate: hasUpdate,
            currentVersion: localVersion,
            latestVersion: remoteVersion
          });
        } catch(e) {
          resolve({ hasUpdate: false, error: 'Could not parse remote version' });
        }
      });
    });
    req.on('error', function(err) {
      resolve({ hasUpdate: false, error: 'Network error: ' + err.message });
    });
    req.end();
  });
});

// Simple semver comparison: returns >0 if a > b, <0 if a < b, 0 if equal
function compareVersions(a, b) {
  var pa = a.split('.').map(Number);
  var pb = b.split('.').map(Number);
  for (var i = 0; i < 3; i++) {
    var na = pa[i] || 0;
    var nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

ipcMain.handle('apply-update', async function() {
  var https = require('https');
  var appDir = __dirname;

  // Create a backup before updating
  createBackup('before-update');

  var downloaded = 0;
  var errors = [];

  for (var i = 0; i < UPDATABLE_FILES.length; i++) {
    var filename = UPDATABLE_FILES[i];
    try {
      var content = await downloadFile(
        'https://raw.githubusercontent.com/' + UPDATE_REPO + '/' + UPDATE_BRANCH + '/' + filename
      );
      var destPath = path.join(appDir, filename);
      fs.writeFileSync(destPath, content, 'utf8');
      downloaded++;
      console.log('Updated: ' + filename);
    } catch(err) {
      console.error('Failed to update ' + filename + ':', err.message);
      errors.push(filename + ': ' + err.message);
    }
  }

  if (errors.length > 0 && downloaded === 0) {
    return { success: false, error: 'Update failed: ' + errors.join(', ') };
  }

  return { success: true, filesUpdated: downloaded, errors: errors };
});

function downloadFile(url) {
  var https = require('https');
  return new Promise(function(resolve, reject) {
    var req = https.request(url, {
      headers: { 'User-Agent': 'FamilyTreeApp/' + app.getVersion() }
    }, function(res) {
      // Follow redirects (GitHub raw sometimes redirects)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve(data); });
    });
    req.on('error', reject);
    req.end();
  });
}

ipcMain.handle('restart-app', function() {
  app.relaunch();
  app.exit(0);
});

// ═══════════════════════════════════════════════════════════════════
// APP LIFECYCLE
// ═══════════════════════════════════════════════════════════════════

app.whenReady().then(async function() {
  await initDatabase();
  createWindow();
  app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', function() {
  if (autoBackupInterval) clearInterval(autoBackupInterval);
  if (db) {
    createBackup('shutdown');
    db.close();
  }
});