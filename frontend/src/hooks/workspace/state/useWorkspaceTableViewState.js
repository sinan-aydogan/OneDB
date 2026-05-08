import { useMemo } from 'react';
import { generateSchemaDDL } from '../../../utils/schema.js';

export const computeBrowseTotalPages = ({ currentTableData, processedData, rowsPerPage }) => {
  const safeRowsPerPage = Math.max(1, Number(rowsPerPage || 1));
  const safePage = Math.max(1, Number(currentTableData?.page || 1));
  const currentPageRows = Math.max(0, Number(processedData?.length || 0));
  const knownRowsThroughCurrentPage = (safePage - 1) * safeRowsPerPage + currentPageRows;
  const rawRowCount = Number(currentTableData?.rowCount || 0);
  const safeRowCount = Number.isFinite(rawRowCount) && rawRowCount >= 0 ? rawRowCount : 0;
  const effectiveTotalRows = currentTableData?.hasMore
    ? Math.max(safeRowCount, knownRowsThroughCurrentPage + 1)
    : knownRowsThroughCurrentPage;
  return Math.max(1, Math.ceil(effectiveTotalRows / safeRowsPerPage));
};

export default function useWorkspaceTableViewState({
  currentTableData,
  currentDriver,
  activeDb,
  activeTable,
  hiddenColumns,
  setHiddenColumns,
  sortConfig,
  setSortConfig,
  pinnedColumnsByTable,
  setPinnedColumnsByTable,
  columnOrderByTable,
  setColumnOrderByTable,
  selectedRows,
  setSelectedRows,
  rowsPerPage,
  copyToClipboard,
  getCellTextValue,
  columnOrderByTable,
  setColumnOrderByTable,
  clearAllColumnFilters,
}) {
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const currentTableDdl = useMemo(
    () =>
      currentTableData
        ? generateSchemaDDL({
            driver: currentDriver,
            tableName: activeTable,
            tableType: currentTableData.type,
            columns: currentTableData.columns,
          })
        : '',
    [activeTable, currentDriver, currentTableData],
  );

  const currentTableKey = useMemo(() => {
    if (!activeDb || !activeTable) return '';
    return `${activeDb}::${activeTable}`;
  }, [activeDb, activeTable]);

  const pinnedColumnNames = useMemo(() => {
    if (!currentTableData || !currentTableKey) return [];
    const fromState = Array.isArray(pinnedColumnsByTable?.[currentTableKey])
      ? pinnedColumnsByTable[currentTableKey]
      : [];
    const valid = new Set(currentTableData.columns.map((column) => column.name));
    return fromState.filter((columnName) => valid.has(columnName));
  }, [currentTableData, currentTableKey, pinnedColumnsByTable]);

  const pinnedColumnSet = useMemo(() => new Set(pinnedColumnNames), [pinnedColumnNames]);

  const orderedColumns = useMemo(() => {
    if (!currentTableData || !currentTableKey) return [];
    const defaultCols = currentTableData.columns;
    const order = columnOrderByTable?.[currentTableKey] || [];
    if (order.length === 0) return defaultCols;

    const colMap = new Map(defaultCols.map((c) => [c.name, c]));
    const result = [];
    const added = new Set();

    order.forEach((name) => {
      if (colMap.has(name)) {
        result.push(colMap.get(name));
        added.add(name);
      }
    });

    defaultCols.forEach((col) => {
      if (!added.has(col.name)) {
        result.push(col);
      }
    });

    return result;
  }, [currentTableData, currentTableKey, columnOrderByTable]);

  const visibleColumns = useMemo(() => {
    if (!currentTableData) return [];
    const filteredColumns = orderedColumns.filter((col) => !hiddenColumns.has(col.name));
    if (pinnedColumnNames.length === 0) {
      return filteredColumns;
    }

    const pinnedByName = new Map(filteredColumns.map((column) => [column.name, column]));
    const pinnedColumns = pinnedColumnNames
      .map((columnName) => pinnedByName.get(columnName))
      .filter(Boolean);
    const unpinnedColumns = filteredColumns.filter((column) => !pinnedColumnSet.has(column.name));
    return [...pinnedColumns, ...unpinnedColumns];
  }, [orderedColumns, hiddenColumns, pinnedColumnNames, pinnedColumnSet]);

  const isColumnPinned = (columnName) => pinnedColumnSet.has(columnName);

  const toggleColumnPin = (columnName) => {
    if (!columnName || !currentTableData || !currentTableKey) return;

    setPinnedColumnsByTable((prev) => {
      const next = { ...(prev || {}) };
      const currentPinned = Array.isArray(next[currentTableKey]) ? next[currentTableKey] : [];

      if (currentPinned.includes(columnName)) {
        const updated = currentPinned.filter((name) => name !== columnName);
        if (updated.length > 0) {
          next[currentTableKey] = updated;
        } else {
          delete next[currentTableKey];
        }
      } else {
        next[currentTableKey] = [...currentPinned, columnName];
      }

      return next;
    });
  };

  const moveColumn = (fromName, toName) => {
    if (!fromName || !toName || fromName === toName || !currentTableKey) return;

    // We handle reordering differently based on whether the columns are pinned or not.
    // If BOTH are pinned, move within pinned state.
    // If BOTH are unpinned, move within general order state.
    // Otherwise, we might need to toggle pin status (but for now let's keep it simple: move in their respective "groups").

    const isFromPinned = pinnedColumnSet.has(fromName);
    const isToPinned = pinnedColumnSet.has(toName);

    if (isFromPinned && isToPinned) {
      const nextPinned = [...pinnedColumnNames];
      const fromIdx = nextPinned.indexOf(fromName);
      const toIdx = nextPinned.indexOf(toName);
      nextPinned.splice(fromIdx, 1);
      nextPinned.splice(toIdx, 0, fromName);
      setPinnedColumnsByTable((prev) => ({ ...prev, [currentTableKey]: nextPinned }));
    } else if (!isFromPinned && !isToPinned) {
      const nextOrder = orderedColumns.map((c) => c.name);
      const fromIdx = nextOrder.indexOf(fromName);
      const toIdx = nextOrder.indexOf(toName);
      nextOrder.splice(fromIdx, 1);
      nextOrder.splice(toIdx, 0, fromName);
      setColumnOrderByTable((prev) => ({ ...prev, [currentTableKey]: nextOrder }));
    }
  };

  const resetColumnOrder = () => {
    if (!currentTableKey) return;
    setColumnOrderByTable((prev) => {
      const next = { ...prev };
      delete next[currentTableKey];
      return next;
    });
    setPinnedColumnsByTable((prev) => {
      const next = { ...prev };
      delete next[currentTableKey];
      return next;
    });
  };

  const resetColumnFilters = () => {
    setHiddenColumns(new Set());
    // Also might want to clear server filters, but this specifically resets visibility.
  };

  const copyRowWithHeaders = (row) => {
    if (!row || !currentTableData) return;
    const text = visibleColumns
      .map((col) => `${col.name}: ${getCellTextValue(row[col.name])}`)
      .join('\n');
    copyToClipboard(text);
  };

  const toggleColumnVisibility = (colName) => {
    setHiddenColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(colName)) newSet.delete(colName);
      else newSet.add(colName);
      return newSet;
    });
  };

  const processedData = useMemo(() => currentTableData?.data || [], [currentTableData]);

  const paginatedData = useMemo(() => processedData, [processedData]);

  const totalPages = useMemo(
    () => computeBrowseTotalPages({ currentTableData, processedData, rowsPerPage }),
    [currentTableData, processedData, rowsPerPage],
  );

  const toggleRowSelection = (origIndex) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(origIndex)) newSet.delete(origIndex);
    else newSet.add(origIndex);
    setSelectedRows(newSet);
  };

  const toggleAllRows = () => {
    if (selectedRows.size === paginatedData.length && paginatedData.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedData.map((r) => r._origIndex)));
    }
  };

  const moveColumn = (fromName, toName) => {
    if (!currentTableKey || !currentTableData) return;
    const columns = currentTableData.columns || [];
    const currentOrder = columnOrderByTable[currentTableKey] || columns.map((c) => c.name);
    const newOrder = [...currentOrder];
    const fromIndex = newOrder.indexOf(fromName);
    const toIndex = newOrder.indexOf(toName);

    if (fromIndex !== -1 && toIndex !== -1) {
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, fromName);
      setColumnOrderByTable((prev) => ({ ...prev, [currentTableKey]: newOrder }));
    }
  };

  const onResetColumnOrder = () => {
    if (!currentTableKey) return;
    setColumnOrderByTable((prev) => {
      const next = { ...prev };
      delete next[currentTableKey];
      return next;
    });
  };

  const onResetColumnFilters = () => {
    setHiddenColumns(new Set());
    clearAllColumnFilters();
  };

  const orderedColumns = useMemo(() => {
    if (!currentTableData) return [];
    const columns = currentTableData.columns || [];
    const order = columnOrderByTable[currentTableKey];
    if (!order) return columns;

    const colMap = new Map(columns.map((c) => [c.name, c]));
    const result = [];
    order.forEach((name) => {
      if (colMap.has(name)) {
        result.push(colMap.get(name));
        colMap.delete(name);
      }
    });
    // Add any remaining columns that weren't in the saved order
    colMap.forEach((col) => result.push(col));
    return result;
  }, [currentTableData, columnOrderByTable, currentTableKey]);

  return {
    handleSort,
    currentTableDdl,
    visibleColumns,
    pinnedColumnNames,
    isColumnPinned,
    toggleColumnPin,
    copyRowWithHeaders,
    toggleColumnVisibility,
    moveColumn,
    resetColumnOrder,
    resetColumnFilters,
    orderedColumns,
    processedData,
    paginatedData,
    totalPages,
    toggleRowSelection,
    toggleAllRows,
    moveColumn,
    onResetColumnOrder,
    onResetColumnFilters,
    orderedColumns,
  };
}
