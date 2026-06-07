const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Trees
  getTrees:              function()              { return ipcRenderer.invoke('get-trees'); },
  getDeletedTrees:       function()              { return ipcRenderer.invoke('get-deleted-trees'); },
  createTree:            function(name, desc)     { return ipcRenderer.invoke('create-tree', name, desc); },
  updateTree:            function(id, name, desc) { return ipcRenderer.invoke('update-tree', id, name, desc); },
  deleteTree:            function(id)             { return ipcRenderer.invoke('delete-tree', id); },
  restoreTree:           function(id)             { return ipcRenderer.invoke('restore-tree', id); },
  permanentlyDeleteTree: function(id)             { return ipcRenderer.invoke('permanently-delete-tree', id); },

  // People
  getPeople:             function(treeId)         { return ipcRenderer.invoke('get-people', treeId); },
  getDeletedPeople:      function(treeId)         { return ipcRenderer.invoke('get-deleted-people', treeId); },
  addPerson:             function(treeId, data)   { return ipcRenderer.invoke('add-person', treeId, data); },
  updatePerson:          function(id, fields)     { return ipcRenderer.invoke('update-person', id, fields); },
  removePerson:          function(id)             { return ipcRenderer.invoke('remove-person', id); },
  restorePerson:         function(id)             { return ipcRenderer.invoke('restore-person', id); },
  permanentlyDeletePerson: function(id)           { return ipcRenderer.invoke('permanently-delete-person', id); },
  searchPeople:          function(treeId, query)  { return ipcRenderer.invoke('search-people', treeId, query); },
  createBackup:          function(reason)         { return ipcRenderer.invoke('create-backup', reason); },

  // Families
  getFamilies:           function(treeId)         { return ipcRenderer.invoke('get-families', treeId); },
  addFamily:             function(treeId, data)   { return ipcRenderer.invoke('add-family', treeId, data); },
  updateFamily:          function(id, fields)     { return ipcRenderer.invoke('update-family', id, fields); },
  moveChild:             function(childId, from, to) { return ipcRenderer.invoke('move-child', childId, from, to); },
  addChildToFamily:      function(childId, famId, pH, pW) { return ipcRenderer.invoke('add-child-to-family', childId, famId, pH, pW); },
  updateChildPedi:       function(childId, famId, pH, pW) { return ipcRenderer.invoke('update-child-pedi', childId, famId, pH, pW); },

  // Events
  getEvents:             function(personId)       { return ipcRenderer.invoke('get-events', personId); },
  addEvent:              function(pid, tid, data)  { return ipcRenderer.invoke('add-event', pid, tid, data); },
  updateEvent:           function(id, fields)     { return ipcRenderer.invoke('update-event', id, fields); },
  removeEvent:           function(id)             { return ipcRenderer.invoke('remove-event', id); },

  // Sources
  getSources:            function(treeId)         { return ipcRenderer.invoke('get-sources', treeId); },
  addSource:             function(treeId, data)   { return ipcRenderer.invoke('add-source', treeId, data); },
  updateSource:          function(id, fields)     { return ipcRenderer.invoke('update-source', id, fields); },
  removeSource:          function(id)             { return ipcRenderer.invoke('remove-source', id); },

  // Citations
  getCitations:          function(type, id)       { return ipcRenderer.invoke('get-citations', type, id); },
  addCitation:           function(data)           { return ipcRenderer.invoke('add-citation', data); },
  removeCitation:        function(id)             { return ipcRenderer.invoke('remove-citation', id); },

  // Attachments
  getAttachments:        function(personId)       { return ipcRenderer.invoke('get-attachments', personId); },
  addAttachment:         function(pid, tid)       { return ipcRenderer.invoke('add-attachment', pid, tid); },
  updateAttachment:      function(id, fields)     { return ipcRenderer.invoke('update-attachment', id, fields); },
  removeAttachment:      function(id)             { return ipcRenderer.invoke('remove-attachment', id); },

  // Research Log
  getResearchLog:        function(personId)       { return ipcRenderer.invoke('get-research-log', personId); },
  addResearchLog:        function(pid, tid, data)  { return ipcRenderer.invoke('add-research-log', pid, tid, data); },
  updateResearchLog:     function(id, fields)     { return ipcRenderer.invoke('update-research-log', id, fields); },
  removeResearchLog:     function(id)             { return ipcRenderer.invoke('remove-research-log', id); },

  // GEDCOM
  importGedcom:          function(treeId)         { return ipcRenderer.invoke('import-gedcom', treeId); },
  exportGedcom:          function(treeId)         { return ipcRenderer.invoke('export-gedcom', treeId); },

  // Backups
  getBackups:            function()              { return ipcRenderer.invoke('get-backups'); },
  restoreBackup:         function(filename)       { return ipcRenderer.invoke('restore-backup', filename); },
  createManualBackup:    function()              { return ipcRenderer.invoke('create-manual-backup'); },

  // Utilities
  pickPhoto:             function(personId)       { return ipcRenderer.invoke('pick-photo', personId); },
  printToPdf:            function()              { return ipcRenderer.invoke('print-to-pdf'); },
  printToPrinter:        function()              { return ipcRenderer.invoke('print-to-printer'); },
  printReport:           function(html)           { return ipcRenderer.invoke('print-report', html); },
  saveReport:            function(html)           { return ipcRenderer.invoke('save-report', html); },

  // Bug Reporting
  getSystemInfo:         function()              { return ipcRenderer.invoke('get-system-info'); },
  submitBugReport:       function(data)           { return ipcRenderer.invoke('submit-bug-report', data); },

  // Auto-Update
  checkForUpdate:        function()              { return ipcRenderer.invoke('check-for-update'); },
  applyUpdate:           function()              { return ipcRenderer.invoke('apply-update'); },
  restartApp:            function()              { return ipcRenderer.invoke('restart-app'); }
});