import { makeDatabasePinKey, makeTablePinKey } from '../../../utils/pins.js';

export default function useWorkspaceNavigationActions({
  t,
  showToast,
  isConnected,
  activeDb,
  activeTable,
  activeTab,
  databases,
  currentTableData,
  cellContextMenu,
  refreshActiveTable,
  refreshSchemas,
  ensureDatabaseTablesLoaded,
  refreshPing,
  executeSql,
  quoteIdentifier,
  escapeLiteral,
  parseJsonCellValue,
  isJsonColumn,
  setIsRefreshing,
  setActiveDb,
  setActiveTable,
  setExpandedDbs,
  setExpandedGroups,
  openTableTabs,
  setOpenTableTabs,
  activeTableTabId,
  setActiveTableTabId,
  setActiveTab,
  setSearchTerm,
  setFilterRuleDrafts,
  setFilterRules,
  setHiddenColumns,
  setSortConfig,
  setServerColumnFilters,
  setColumnMenu,
  setSelectedRows,
  setPage,
  setEditingCell,
  setCellContextMenu,
  setSchemaViewMode,
  setIsCommandOpen,
  setSqlQuery,
  setSqlResult,
  setContextMenu,
  setModalConfig,
  setPinnedItems,
}) {
  const buildTableTabId = (dbName, tableName) => `${dbName}::${tableName}`;
  const orderTabs = (tabs) => {
    const pinned = tabs.filter((tab) => tab.pinned);
    const normal = tabs.filter((tab) => !tab.pinned);
    return [...pinned, ...normal];
  };

  const syncActiveAfterTabUpdate = (nextTabs, preferredTabId = null) => {
    if (nextTabs.length === 0) {
      setActiveTableTabId(null);
      setActiveTable(null);
      return;
    }

    const stillActive = nextTabs.find((tab) => tab.id === activeTableTabId);
    if (stillActive) {
      return;
    }

    const preferredActive = preferredTabId
      ? nextTabs.find((tab) => tab.id === preferredTabId)
      : null;
    const fallbackTab = stillActive || preferredActive || nextTabs[0];

    if (!fallbackTab) {
      setActiveTableTabId(null);
      setActiveTable(null);
      return;
    }

    setActiveTableTabId(fallbackTab.id);
    setActiveDb(fallbackTab.dbName);
    setActiveTable(fallbackTab.tableName);
    setActiveTab('browse');
    setSqlQuery(`SELECT * FROM ${quoteIdentifier(fallbackTab.tableName)} LIMIT 50;`);
    setSqlResult(null);
  };

  const registerTableTab = (dbName, tableName, isTransient = false) => {
    const tabId = buildTableTabId(dbName, tableName);

    setOpenTableTabs((prev) => {
      const existingTabIndex = prev.findIndex((tab) => tab.id === tabId);

      // If opening as transient
      if (isTransient) {
        // If it already exists (even if pinned or transient), just keep it as is
        // but if it was permanent, don't make it transient.
        // Actually, if it exists, we just return prev.
        if (existingTabIndex >= 0) {
          return prev;
        }

        // Replace any existing transient tab, or add a new one
        const withoutTransient = prev.filter((tab) => !tab.isTransient);
        return orderTabs([
          ...withoutTransient,
          { id: tabId, dbName, tableName, pinned: false, isTransient: true },
        ]);
      }

      // If opening as permanent (normal)
      if (existingTabIndex >= 0) {
        // Promote if it was transient
        if (prev[existingTabIndex].isTransient) {
          const next = [...prev];
          next[existingTabIndex] = { ...next[existingTabIndex], isTransient: false };
          return next;
        }
        return prev;
      }

      // Add new permanent tab
      return orderTabs([
        ...prev,
        { id: tabId, dbName, tableName, pinned: false, isTransient: false },
      ]);
    });
    setActiveTableTabId(tabId);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (activeDb && activeTable) {
        await refreshActiveTable();
      } else if (isConnected) {
        await refreshSchemas();
        if (activeDb) {
          await ensureDatabaseTablesLoaded(activeDb, { force: true });
        }
      }
      await refreshPing();
      setIsRefreshing(false);
      showToast(t('dataUpdated'), 'success');
    } catch (error) {
      setIsRefreshing(false);
      showToast(error.message || 'Refresh failed.', 'error');
    }
  };

  const resolveTableType = (dbName, tableName, loadedEntries = []) => {
    const fromLoaded = Array.isArray(loadedEntries)
      ? loadedEntries.find((entry) => entry?.name === tableName)
      : null;
    const fromState = databases?.[dbName]?.[tableName];
    return String(fromLoaded?.type || fromState?.type || 'table').toLowerCase() === 'view'
      ? 'view'
      : 'table';
  };

  const selectDbAndTable = async (dbName, tableName, forceTab = null, isTransient = false) => {
    let loadedEntries = [];
    try {
      loadedEntries = (await ensureDatabaseTablesLoaded(dbName)) || [];
    } catch (error) {
      showToast(error.message || 'Failed to load table list.', 'error');
      return;
    }
    const tableType = resolveTableType(dbName, tableName, loadedEntries);
    setExpandedDbs?.((prev) => ({ ...prev, [dbName]: true }));
    setExpandedGroups?.((prev) => {
      const next = { ...(prev || {}) };
      const tableGroupKey = `${dbName}_tables`;
      const viewGroupKey = `${dbName}_views`;
      if (tableType === 'view') {
        next[viewGroupKey] = true;
      } else {
        next[tableGroupKey] = true;
      }
      return next;
    });
    setActiveDb(dbName);
    setActiveTable(tableName);
    if (forceTab) setActiveTab(forceTab);
    else if (activeTab !== 'browse' && activeTab !== 'schema' && activeTab !== 'sql')
      setActiveTab('browse');

    setSearchTerm('');
    setFilterRuleDrafts([]);
    setFilterRules([]);
    setHiddenColumns(new Set());
    setSortConfig({ key: null, direction: 'asc' });
    setServerColumnFilters({});
    setColumnMenu({ columnName: null, draft: null });
    setSelectedRows(new Set());
    setPage(1);
    setEditingCell(null);
    setCellContextMenu((prev) => ({ ...prev, visible: false }));
    setSchemaViewMode('table');
    setIsCommandOpen(false);
    setSqlQuery(`SELECT * FROM ${quoteIdentifier(tableName)} LIMIT 50;`);
    setSqlResult(null);
    registerTableTab(dbName, tableName, isTransient);
  };

  const activateTableTab = async (tabId) => {
    const targetTab = openTableTabs.find((tab) => tab.id === tabId);
    if (!targetTab) return;
    await selectDbAndTable(targetTab.dbName, targetTab.tableName, activeTab);
  };

  const closeTableTab = (tabId) => {
    if (!tabId) return;
    setOpenTableTabs((prev) => {
      const closingIndex = prev.findIndex((tab) => tab.id === tabId);
      if (closingIndex < 0) return prev;
      const nextTabs = prev.filter((tab) => tab.id !== tabId);
      if (activeTableTabId === tabId) {
        const fallbackTab =
          nextTabs[Math.max(0, closingIndex - 1)] || nextTabs[closingIndex] || nextTabs[0] || null;
        syncActiveAfterTabUpdate(nextTabs, fallbackTab?.id || null);
      }
      return nextTabs;
    });
  };

  const closeOtherTableTabs = (tabId) => {
    if (!tabId) return;
    setOpenTableTabs((prev) => {
      const keep = prev.filter((tab) => tab.id === tabId || tab.pinned);
      const dedupedKeep = keep.filter(
        (tab, index, arr) => arr.findIndex((entry) => entry.id === tab.id) === index,
      );
      syncActiveAfterTabUpdate(dedupedKeep, tabId);
      return dedupedKeep;
    });
  };

  const closeTableTabsToRight = (tabId) => {
    if (!tabId) return;
    setOpenTableTabs((prev) => {
      const currentIndex = prev.findIndex((tab) => tab.id === tabId);
      if (currentIndex < 0) return prev;
      const nextTabs = prev.filter((tab, index) => tab.pinned || index <= currentIndex);
      syncActiveAfterTabUpdate(nextTabs, tabId);
      return nextTabs;
    });
  };

  const closeAllTableTabs = () => {
    setOpenTableTabs((prev) => {
      const nextTabs = prev.filter((tab) => tab.pinned);
      syncActiveAfterTabUpdate(nextTabs);
      return nextTabs;
    });
  };

  const toggleTableTabPin = (tabId) => {
    if (!tabId) return;
    setOpenTableTabs((prev) => {
      const nextTabs = prev.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              pinned: !tab.pinned,
              isTransient: false, // Pinning makes it permanent
            }
          : tab,
      );
      return orderTabs(nextTabs);
    });
  };

  const promoteTableTab = (tabId) => {
    if (!tabId) return;
    setOpenTableTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, isTransient: false } : tab)),
    );
  };

  const moveTableTab = (dragTabId, targetTabId, position = 'before') => {
    if (!dragTabId || !targetTabId || dragTabId === targetTabId) return;
    const normalizedPosition = position === 'after' ? 'after' : 'before';
    setOpenTableTabs((prev) => {
      const dragTab = prev.find((tab) => tab.id === dragTabId);
      const targetTab = prev.find((tab) => tab.id === targetTabId);
      if (!dragTab || !targetTab) return prev;
      if (Boolean(dragTab.pinned) !== Boolean(targetTab.pinned)) return prev;

      const withoutDrag = prev.filter((tab) => tab.id !== dragTabId);
      const targetIndex = withoutDrag.findIndex((tab) => tab.id === targetTabId);
      if (targetIndex < 0) return prev;
      if (Boolean(withoutDrag[targetIndex]?.pinned) !== Boolean(dragTab.pinned)) return prev;

      const insertAt = normalizedPosition === 'after' ? targetIndex + 1 : targetIndex;
      const nextTabs = [...withoutDrag.slice(0, insertAt), dragTab, ...withoutDrag.slice(insertAt)];

      const unchanged =
        nextTabs.length === prev.length &&
        nextTabs.every((tab, index) => tab.id === prev[index]?.id);
      return unchanged ? prev : nextTabs;
    });
  };

  const isTableTabPinned = (tabId) => {
    if (!tabId) return false;
    return openTableTabs.some((tab) => tab.id === tabId && tab.pinned);
  };

  const handleContextMenu = (e, dbName, tableName) => {
    e.preventDefault();
    setCellContextMenu((prev) => ({ ...prev, visible: false }));
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, dbName, tableName });
  };

  const openCellContextMenu = (event, rowIndex, column, rawValue) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu((prev) => ({ ...prev, visible: false }));

    const parsed = parseJsonCellValue(rawValue);
    setCellContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      rowIndex,
      colName: column.name,
      value: rawValue,
      canShowJson: isJsonColumn(column) || parsed !== null,
    });
  };

  const closeCellContextMenu = () => {
    setCellContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const openCellJsonViewerFromMenu = () => {
    if (!cellContextMenu.visible) return;
    setModalConfig({
      isOpen: true,
      type: 'json_viewer',
      data: {
        columnName: cellContextMenu.colName,
        value: cellContextMenu.value,
      },
    });
    closeCellContextMenu();
  };

  const setCellNullFromMenu = async () => {
    if (!currentTableData || !activeTable || currentTableData.type === 'view') {
      closeCellContextMenu();
      return;
    }

    const targetRow = currentTableData.data[cellContextMenu.rowIndex];
    if (!targetRow || !cellContextMenu.colName) {
      closeCellContextMenu();
      return;
    }

    const pkCol = currentTableData.columns.find((c) => c.isPrimary);
    if (!pkCol) {
      showToast('Primary key is required for update.', 'error');
      closeCellContextMenu();
      return;
    }

    if (targetRow[cellContextMenu.colName] === null) {
      closeCellContextMenu();
      return;
    }

    try {
      const sql = `UPDATE ${quoteIdentifier(activeTable)} SET ${quoteIdentifier(cellContextMenu.colName)} = NULL WHERE ${quoteIdentifier(pkCol.name)} = ${escapeLiteral(targetRow[pkCol.name])};`;
      await executeSql(sql);
      await refreshActiveTable();
      showToast(t('recordUpdated'), 'success');
    } catch (error) {
      showToast(error.message || 'Update failed.', 'error');
    } finally {
      closeCellContextMenu();
    }
  };

  const togglePinDatabase = (dbName) => {
    const pinKey = makeDatabasePinKey(dbName);
    setPinnedItems((prev) => {
      if (prev.includes(pinKey)) return prev.filter((key) => key !== pinKey);
      return [...prev, pinKey];
    });
  };

  const togglePinTable = (dbName, tableName) => {
    const pinKey = makeTablePinKey(dbName, tableName);
    setPinnedItems((prev) => {
      if (prev.includes(pinKey)) return prev.filter((key) => key !== pinKey);
      return [...prev, pinKey];
    });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  return {
    handleRefresh,
    selectDbAndTable,
    handleContextMenu,
    openCellContextMenu,
    closeCellContextMenu,
    openCellJsonViewerFromMenu,
    setCellNullFromMenu,
    togglePinDatabase,
    togglePinTable,
    activateTableTab,
    closeTableTab,
    closeOtherTableTabs,
    closeTableTabsToRight,
    closeAllTableTabs,
    toggleTableTabPin,
    isTableTabPinned,
    promoteTableTab,
    moveTableTab,
  };
}
