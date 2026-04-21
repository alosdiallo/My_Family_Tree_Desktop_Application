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

  db.run('CREATE INDEX IF NOT EXISTS idx_events_person ON events(person_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_tree ON events(tree_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sources_tree ON sources(tree_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_citations_source ON citations(source_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_citations_record ON citations(record_type, record_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_attachments_person ON attachments(person_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_attachments_tree ON attachments(tree_id)');
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
  var allowed = ['name','sex','birth_date','death_date','is_adopted','address','country','photo_path','gedcom_id','burial_location','notes'];
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
    return Object.assign({}, f, {
      childIds: queryAll('SELECT child_id FROM family_children WHERE family_id = ?', [f.id]).map(function(r) { return r.child_id; })
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
// SEARCH
// ═══════════════════════════════════════════════════════════════════

ipcMain.handle('search-people', function(ev, treeId, query) {
  var q = '%' + query + '%';
  return queryAll(
    'SELECT * FROM people WHERE tree_id = ? AND deleted_at IS NULL AND (name LIKE ? OR birth_date LIKE ? OR death_date LIKE ? OR address LIKE ? OR country LIKE ?) ORDER BY name',
    [treeId, q, q, q, q, q]
  );
});

// ═══════════════════════════════════════════════════════════════════
// GEDCOM IMPORT
// ═══════════════════════════════════════════════════════════════════

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
    var lines = raw.split(/\r?\n/);
    var records = [];
    var current = null;

    for (var i = 0; i < lines.length; i++) {
      var match = lines[i].match(/^(\d+)\s+(@\S+@)?\s*(\S+)\s*(.*)?$/);
      if (!match) continue;
      var level = parseInt(match[1]);
      var pointer = match[2];
      var tag = match[3];
      var value = match[4];

      if (level === 0) {
        if (current) records.push(current);
        if (pointer && (tag === 'INDI' || tag === 'FAM')) {
          current = { type: tag, id: pointer, data: {}, children: [] };
        } else { current = null; }
      } else if (current) {
        if (level === 1) { current.data[tag] = value || pointer || ''; current._lastTag = tag; }
        else if (level === 2 && current._lastTag) {
          if (!current.data[current._lastTag + '_' + tag]) current.data[current._lastTag + '_' + tag] = value || '';
        }
        if (tag === 'CHIL') { current.children.push(value || pointer || ''); }
      }
    }
    if (current) records.push(current);

    var gedcomToPersonId = {};
    var indiCount = 0;

    for (var j = 0; j < records.length; j++) {
      var rec = records[j];
      if (rec.type !== 'INDI') continue;
      var rawName = (rec.data.NAME || 'Unknown').replace(/\//g, '').trim();
      var birthPlace = rec.data.BIRT_PLAC || '';
      var personCountry = null;
      if (birthPlace) {
        var placeParts = birthPlace.split(',');
        personCountry = placeParts[placeParts.length - 1].trim() || null;
      }
      db.run('INSERT INTO people (tree_id, gedcom_id, name, sex, birth_date, death_date, address, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [treeId, rec.id, rawName, rec.data.SEX || null, rec.data.BIRT_DATE || null, rec.data.DEAT_DATE || null, birthPlace || null, personCountry]);
      gedcomToPersonId[rec.id] = lastInsertId();
      indiCount++;
    }

    var famCount = 0;
    for (var k = 0; k < records.length; k++) {
      var rec = records[k];
      if (rec.type !== 'FAM') continue;
      var hId = gedcomToPersonId[rec.data.HUSB] || null;
      var wId = gedcomToPersonId[rec.data.WIFE] || null;
      var hasDivorce = rec.data.DIV !== undefined;

      db.run('INSERT INTO families (tree_id, gedcom_id, husband_id, wife_id, status, marriage_date, marriage_place) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [treeId, rec.id, hId, wId, hasDivorce ? 'divorced' : 'married', rec.data.MARR_DATE || null, rec.data.MARR_PLAC || null]);
      var famId = lastInsertId();

      (rec.children || []).forEach(function(childGedcomId) {
        var childId = gedcomToPersonId[childGedcomId];
        if (childId) db.run('INSERT OR IGNORE INTO family_children (family_id, child_id) VALUES (?, ?)', [famId, childId]);
      });
      famCount++;
    }

    db.run("UPDATE trees SET updated_at = datetime('now') WHERE id = ?", [treeId]);
    saveDb();
    return { individuals: indiCount, families: famCount, canceled: false };
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

    var personGid = {};
    var famGid = {};
    var ic = 1, fc = 1;
    people.forEach(function(p) { personGid[p.id] = p.gedcom_id || ('@I' + ic++ + '@'); });
    families.forEach(function(f) { famGid[f.id] = f.gedcom_id || ('@F' + fc++ + '@'); });

    var out = ['0 HEAD', '1 SOUR FamilyTreeApp', '2 NAME Family Tree', '2 VERS 2.0',
      '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];

    people.forEach(function(p) {
      var gid = personGid[p.id];
      out.push('0 ' + gid + ' INDI');
      if (p.name) {
        var parts = p.name.trim().split(/\s+/);
        var gedName = parts.length > 1 ? parts.slice(0, -1).join(' ') + ' /' + parts.slice(-1)[0] + '/' : p.name + ' //';
        out.push('1 NAME ' + gedName);
      }
      if (p.sex) out.push('1 SEX ' + p.sex);
      if (p.birth_date) { out.push('1 BIRT'); out.push('2 DATE ' + p.birth_date); }
      if (p.death_date) { out.push('1 DEAT'); out.push('2 DATE ' + p.death_date); }
      if (p.address || p.country) {
        out.push('1 RESI');
        if (p.address) out.push('2 ADDR ' + p.address);
        if (p.country) out.push('2 CTRY ' + p.country);
      }
      families.forEach(function(f) {
        if (f.husband_id === p.id || f.wife_id === p.id) out.push('1 FAMS ' + famGid[f.id]);
      });
      families.forEach(function(f) {
        var kids = queryAll('SELECT child_id FROM family_children WHERE family_id = ?', [f.id]);
        if (kids.some(function(k) { return k.child_id === p.id; })) {
          out.push('1 FAMC ' + famGid[f.id]);
          if (p.is_adopted) out.push('2 PEDI adopted');
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