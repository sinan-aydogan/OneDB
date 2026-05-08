import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  Check,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  CopyPlus,
  FileDown,
  FileText,
  Key,
  Link as LinkIcon,
  Maximize2,
  MoreHorizontal,
  Pin,
  Plus,
  Settings,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import HoverTooltip from '../shared/HoverTooltip.jsx';
import MenuSurface from '../shared/MenuSurface.jsx';
import SelectField from '../shared/SelectField.jsx';
import TemporalInputField from '../shared/TemporalInputField.jsx';

export default function TableBrowserView({
  t,
  tc,
  currentTableData,
  visibleColumns,
  hiddenColumns,
  toggleColumnVisibility,
  pinnedColumnNames = [],
  isColumnPinned = () => false,
  toggleColumnPin = () => {},
  isColsPanelOpen,
  setIsColsPanelOpen,
  selectedRows,
  paginatedData,
  page,
  rowsPerPage,
  setRowsPerPage,
  setPage,
  processedData,
  activeColumnFilterCount,
  hasDataFilters,
  isFilterPanelOpen,
  setIsFilterPanelOpen,
  serverColumnFilters,
  clearAllColumnFilters,
  sortConfig,
  setSortConfig,
  openColumnMenu,
  columnMenu,
  setColumnMenu,
  getFilterOperatorOptions,
  isNumericColumn,
  isTemporalColumn,
  applyColumnFilter,
  clearColumnFilter,
  getColumnIcon,
  toggleAllRows,
  toggleRowSelection,
  renderCellContent,
  getCellTextValue,
  getTimestampTooltip,
  showCellTooltipOnHover = true,
  isJsonColumn,
  formatJsonCellValue,
  copyToClipboard,
  editingCell,
  setEditingCell,
  saveInlineEdit,
  setModalConfig,
  setFormData,
  setRowDetailsTab,
  handleBulkDelete,
  handleExportTable,
  handleCloneRow,
  handleDeleteRow,
  copyRowWithHeaders,
  onCellContextMenu,
  moveColumn,
  showToolbar = true,
}) {
  const selectClass = `w-full appearance-none bg-[#18181b] border border-[#3a3a3f] rounded-md text-zinc-100 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${tc.focusRing}`;
  const scrollContainerRef = useRef(null);
  const indexHeaderRef = useRef(null);
  const columnHeaderRefs = useRef({});
  const filterButtonRef = useRef(null);
  const columnsButtonRef = useRef(null);
  const columnTriggerRefs = useRef({});
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [pinnedLeftOffsets, setPinnedLeftOffsets] = useState({});
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [dropTargetColumn, setDropTargetColumn] = useState(null);
  const ROW_HEIGHT = 36;
  const OVERSCAN_ROWS = 10;
  const safePage = Math.max(1, Number(page || 1));
  const safeRowsPerPage = Math.max(1, Number(rowsPerPage || 1));
  const currentPageRowCount = Math.max(0, Number(processedData?.length || 0));
  const knownRowsThroughCurrentPage = (safePage - 1) * safeRowsPerPage + currentPageRowCount;
  const rawRowCount = Number(currentTableData?.rowCount || 0);
  const safeRowCount = Number.isFinite(rawRowCount) && rawRowCount >= 0 ? rawRowCount : 0;
  const hasMoreRows = Boolean(currentTableData?.hasMore);
  const effectiveTotalRows = hasMoreRows
    ? Math.max(safeRowCount, knownRowsThroughCurrentPage + 1)
    : knownRowsThroughCurrentPage;
  const effectiveTotalPages = Math.max(1, Math.ceil(effectiveTotalRows / safeRowsPerPage));
  const canGoPrevPage = safePage > 1;
  const canGoNextPage = hasMoreRows || safePage < effectiveTotalPages;
  const rowOffset = (page - 1) * rowsPerPage;
  const allRowsSelected = paginatedData.length > 0 && selectedRows.size === paginatedData.length;
  const shouldVirtualizeRows = paginatedData.length > 80;
  const appliedServerFilterEntries = Object.entries(serverColumnFilters || {}).filter(
    ([, filterConfig]) =>
      filterConfig &&
      typeof filterConfig === 'object' &&
      String(filterConfig.value ?? '').trim() !== '',
  );
  const virtualWindow = useMemo(() => {
    if (!shouldVirtualizeRows) {
      return {
        startIndex: 0,
        endIndex: paginatedData.length,
        topPadding: 0,
        bottomPadding: 0,
        rows: paginatedData,
      };
    }

    const safeViewportHeight = Math.max(viewportHeight, ROW_HEIGHT * 8);
    const visibleRows = Math.ceil(safeViewportHeight / ROW_HEIGHT);
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
    const endIndex = Math.min(paginatedData.length, startIndex + visibleRows + OVERSCAN_ROWS * 2);

    return {
      startIndex,
      endIndex,
      topPadding: startIndex * ROW_HEIGHT,
      bottomPadding: Math.max(0, (paginatedData.length - endIndex) * ROW_HEIGHT),
      rows: paginatedData.slice(startIndex, endIndex),
    };
  }, [paginatedData, scrollTop, shouldVirtualizeRows, viewportHeight]);
  const tableRows = virtualWindow.rows;
  const dataColumnSpan = visibleColumns.length + 2;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const syncViewportState = () => {
      setScrollTop(container.scrollTop);
      setViewportHeight(container.clientHeight);
    };

    syncViewportState();
    container.addEventListener('scroll', syncViewportState, { passive: true });

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(syncViewportState);
      resizeObserver.observe(container);
    }

    return () => {
      container.removeEventListener('scroll', syncViewportState);
      resizeObserver?.disconnect();
    };
  }, [currentTableData?.name, paginatedData.length]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = 0;
    setScrollTop(0);
  }, [page, rowsPerPage]);

  useEffect(() => {
    const recalcPinnedOffsets = () => {
      if (
        !indexHeaderRef.current ||
        !Array.isArray(pinnedColumnNames) ||
        pinnedColumnNames.length === 0
      ) {
        setPinnedLeftOffsets({});
        return;
      }

      let runningLeft = indexHeaderRef.current.offsetWidth || 80;
      const nextOffsets = {};

      pinnedColumnNames.forEach((columnName) => {
        const headerNode = columnHeaderRefs.current[columnName];
        if (!headerNode) return;
        nextOffsets[columnName] = runningLeft;
        runningLeft += headerNode.offsetWidth || 160;
      });

      setPinnedLeftOffsets(nextOffsets);
    };

    recalcPinnedOffsets();

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(recalcPinnedOffsets);
      if (indexHeaderRef.current) {
        resizeObserver.observe(indexHeaderRef.current);
      }
      pinnedColumnNames.forEach((columnName) => {
        const node = columnHeaderRefs.current[columnName];
        if (node) {
          resizeObserver.observe(node);
        }
      });
    }

    window.addEventListener('resize', recalcPinnedOffsets);
    return () => {
      window.removeEventListener('resize', recalcPinnedOffsets);
      resizeObserver?.disconnect();
    };
  }, [pinnedColumnNames, visibleColumns, currentTableData?.name]);

  const cellMetaByRow = useMemo(() => {
    const metadata = new Map();

    for (const row of tableRows) {
      const columnMeta = {};

      for (const col of visibleColumns) {
        const rawValue = row[col.name];
        const cellTextValue = getCellTextValue(rawValue);
        const timestampTooltip = getTimestampTooltip(rawValue, col);
        const hoverTooltip = showCellTooltipOnHover
          ? timestampTooltip || (cellTextValue.length > 35 ? cellTextValue : '')
          : '';

        columnMeta[col.name] = {
          rawValue,
          cellTextValue,
          timestampTooltip,
          hoverTooltip,
          jsonPreview: isJsonColumn(col) ? formatJsonCellValue(rawValue) : '',
          renderedValue: renderCellContent(row, col),
        };
      }

      metadata.set(row._origIndex, columnMeta);
    }

    return metadata;
  }, [
    formatJsonCellValue,
    getCellTextValue,
    getTimestampTooltip,
    showCellTooltipOnHover,
    isJsonColumn,
    renderCellContent,
    tableRows,
    visibleColumns,
  ]);

  return (
    <div data-testid="table-browser-view" className="flex-1 flex flex-col h-full relative">
      {showToolbar && (
        <div className="flex justify-between items-center px-4 py-2 border-b border-[#2e2e32] bg-[#18181b] shrink-0 z-20">
          <div className="flex items-center gap-2">
            {currentTableData.type !== 'view' && (
              <>
                <button
                  onClick={() => {
                    setFormData({});
                    setRowDetailsTab('details');
                    setModalConfig({
                      isOpen: true,
                      type: 'row_form',
                      editIndex: -1,
                      viewOnly: false,
                    });
                  }}
                  className={`${tc.bg} ${tc.hoverBg} text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors`}
                >
                  <Plus className="w-3.5 h-3.5" /> {t('addRow')}
                </button>
                <div className="h-4 w-[1px] bg-[#333] mx-1" />
              </>
            )}

            {selectedRows.size > 0 && currentTableData.type !== 'view' && (
              <>
                <span className="text-xs text-zinc-400 mx-2">
                  {selectedRows.size} {t('selected')}
                </span>
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t('delSelected')}
                </button>
                <button
                  onClick={() => handleExportTable('sql')}
                  className="bg-[#232323] border border-[#333] hover:bg-[#2e2e32] text-zinc-300 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" /> {t('exportSql')}
                </button>
              </>
            )}

            {(selectedRows.size === 0 || currentTableData.type === 'view') && (
              <>
                <div className="relative">
                  <button
                    ref={filterButtonRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFilterPanelOpen(!isFilterPanelOpen);
                    }}
                    className={`px-2 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors border ${activeColumnFilterCount > 0 ? `${tc.border} ${tc.textLight} ${tc.lightBg}` : 'border-[#333] text-zinc-400 hover:bg-[#232323]'}`}
                  >
                    {t('filters')}{' '}
                    {activeColumnFilterCount > 0 ? `(${activeColumnFilterCount})` : ''}
                  </button>
                  <MenuSurface
                    open={isFilterPanelOpen}
                    anchor={filterButtonRef}
                    placement="bottom-start"
                    onClick={(e) => e.stopPropagation()}
                    className="p-3 z-[110] w-72"
                  >
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                      {t('filters')}
                    </div>
                    {appliedServerFilterEntries.length > 0 ? (
                      <div className="space-y-1.5 max-h-56 overflow-auto">
                        {appliedServerFilterEntries.map(([columnName, filterConfig]) => (
                          <div
                            key={columnName}
                            className="text-xs text-zinc-300 bg-[#232323] border border-[#333] rounded px-2 py-1.5"
                          >
                            <span className="text-zinc-200">{columnName}</span>
                            <span className="text-zinc-500">
                              {' '}
                              {String(filterConfig?.operator || 'contains')}{' '}
                            </span>
                            <span className="text-zinc-400">
                              {String(filterConfig?.value || '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500 py-2">{t('noFilterResults')}</div>
                    )}
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        type="button"
                        onClick={clearAllColumnFilters}
                        disabled={appliedServerFilterEntries.length === 0}
                        className="px-2 py-1.5 rounded text-xs border border-[#333] text-zinc-300 hover:bg-[#2e2e32] disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        {t('clearFilter')}
                      </button>
                    </div>
                  </MenuSurface>
                </div>
                <div className="relative">
                  <button
                    ref={columnsButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsColsPanelOpen(!isColsPanelOpen);
                    }}
                    className={`px-2 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors border ${hiddenColumns.size > 0 ? `${tc.border} ${tc.textLight} ${tc.lightBg}` : 'border-[#333] text-zinc-400 hover:bg-[#232323]'}`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" /> {t('columns')}{' '}
                    {hiddenColumns.size > 0 &&
                      `(${currentTableData.columns.length - hiddenColumns.size}/${currentTableData.columns.length})`}
                  </button>
                  <MenuSurface
                    open={isColsPanelOpen}
                    anchor={columnsButtonRef}
                    placement="bottom-start"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 z-[100] w-48"
                  >
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">
                      {t('columns')}
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {currentTableData.columns.map((column) => (
                        <label
                          key={column.name}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#2e2e32] rounded cursor-pointer text-xs text-zinc-300"
                        >
                          <input
                            type="checkbox"
                            checked={!hiddenColumns.has(column.name)}
                            onChange={() => toggleColumnVisibility(column.name)}
                            className={`rounded-sm bg-[#18181b] border-[#444] ${tc.accent}`}
                          />
                          {column.name}
                        </label>
                      ))}
                    </div>
                  </MenuSurface>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentTableData.type !== 'view' && (
              <button
                onClick={() => setModalConfig({ isOpen: true, type: 'import' })}
                className="text-zinc-400 hover:text-zinc-200 text-xs flex items-center gap-1.5 px-2 py-1.5 rounded border border-[#333] hover:bg-[#232323] transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5" /> {t('import')}
              </button>
            )}
            <button
              onClick={() => setModalConfig({ isOpen: true, type: 'export' })}
              className="text-zinc-400 hover:text-zinc-200 text-xs flex items-center gap-1.5 px-2 py-1.5 rounded border border-[#333] hover:bg-[#232323] transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" /> {t('export')}
            </button>
          </div>
        </div>
      )}

      <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-[#18181b]">
        <table className="w-full text-left text-sm whitespace-nowrap border-collapse select-none">
          <thead className="bg-[#1c1c1c] text-zinc-400 sticky top-0 z-10 shadow-sm border-b border-[#2e2e32]">
            <tr>
              <th
                ref={indexHeaderRef}
                className={`px-3 py-2 w-20 border-r border-[#2e2e32] font-normal sticky left-0 z-[26] bg-[#1c1c1c] shadow-[inset_-1px_0_0_rgba(46,46,50,1)] ${currentTableData.type !== 'view' ? 'cursor-pointer' : ''}`}
                onClick={currentTableData.type !== 'view' ? toggleAllRows : undefined}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {currentTableData.type !== 'view' && allRowsSelected && (
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded border ${tc.border} ${tc.textLight} ${tc.lightBg}`}
                    >
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                  <span>#</span>
                </div>
              </th>
              {visibleColumns.map((col) => {
                const pinned = isColumnPinned(col.name);
                const pinnedLeft = pinnedLeftOffsets[col.name];

                return (
                  <th
                    key={col.name}
                    ref={(node) => {
                      if (node) {
                        columnHeaderRefs.current[col.name] = node;
                      } else {
                        delete columnHeaderRefs.current[col.name];
                      }
                    }}
                    className={`px-4 py-2 border-r border-[#2e2e32] font-normal last:border-r-0 hover:bg-[#232323] transition-colors group relative align-top cursor-default ${
                      pinned ? 'sticky bg-[#1c1c1c] shadow-[inset_-1px_0_0_rgba(46,46,50,1)]' : ''
                    } ${dropTargetColumn === col.name ? `border-b-2 ${tc.border}` : ''} ${draggedColumn === col.name ? 'opacity-40' : ''}`}
                    style={{
                      resize: 'vertical',
                      overflow: 'hidden',
                      minWidth: '100px',
                      ...(pinned && pinnedLeft !== undefined
                        ? { left: `${pinnedLeft}px`, zIndex: 24 }
                        : {}),
                    }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', col.name);
                      setDraggedColumn(col.name);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedColumn && draggedColumn !== col.name) {
                        setDropTargetColumn(col.name);
                      }
                    }}
                    onDragLeave={() => {
                      setDropTargetColumn(null);
                    }}
                    onDragEnd={() => {
                      setDraggedColumn(null);
                      setDropTargetColumn(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromName = e.dataTransfer.getData('text/plain');
                      if (fromName && fromName !== col.name) {
                        moveColumn?.(fromName, col.name);
                      }
                      setDraggedColumn(null);
                      setDropTargetColumn(null);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getColumnIcon(col.type)}
                        <span className="text-zinc-200 font-medium">{col.name}</span>
                        {pinned ? <Pin className={`w-3 h-3 ${tc.textLight} opacity-80`} /> : null}
                        {col.isPrimary && <Key className="w-3 h-3 text-amber-500 opacity-70" />}
                        {col.isForeign && (
                          <LinkIcon
                            className="w-3 h-3 text-blue-400 opacity-70"
                            title="Foreign Key"
                          />
                        )}
                      </div>
                      <div className="flex items-center">
                        {sortConfig.key === col.name && (
                          <ArrowDownUp
                            className={`w-3.5 h-3.5 mr-1 ${tc.textLight} ${sortConfig.direction === 'desc' ? 'rotate-180' : ''} transition-transform`}
                          />
                        )}
                        <button
                          ref={(node) => {
                            if (node) {
                              columnTriggerRefs.current[col.name] = node;
                            } else {
                              delete columnTriggerRefs.current[col.name];
                            }
                          }}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openColumnMenu(col);
                          }}
                          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#2e2e32] opacity-0 group-hover:opacity-100 transition-opacity"
                          title={t('columnOptions')}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <MenuSurface
                      open={columnMenu.columnName === col.name && Boolean(columnMenu.draft)}
                      anchor={columnTriggerRefs.current[col.name] || null}
                      placement="bottom-end"
                      onClick={(e) => e.stopPropagation()}
                      className="p-3 z-[120] w-64"
                    >
                      {columnMenu.columnName === col.name && columnMenu.draft ? (
                        <>
                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                            {t('columnOptions')}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <button
                              type="button"
                              onClick={() => {
                                toggleColumnPin(col.name);
                                setColumnMenu({ columnName: null, draft: null });
                              }}
                              className={`col-span-2 px-2 py-1.5 rounded text-xs border flex items-center justify-center gap-1.5 ${
                                pinned
                                  ? `${tc.border} ${tc.textLight} ${tc.lightBg}`
                                  : 'border-[#333] text-zinc-300 hover:bg-[#2e2e32]'
                              }`}
                            >
                              <Pin className="w-3.5 h-3.5" />
                              {pinned ? t('unpinColumn') : t('pinColumn')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPage(1);
                                setSortConfig({ key: col.name, direction: 'asc' });
                                setColumnMenu({ columnName: null, draft: null });
                              }}
                              className="px-2 py-1.5 rounded text-xs border border-[#333] text-zinc-300 hover:bg-[#2e2e32]"
                            >
                              {t('sortAsc')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPage(1);
                                setSortConfig({ key: col.name, direction: 'desc' });
                                setColumnMenu({ columnName: null, draft: null });
                              }}
                              className="px-2 py-1.5 rounded text-xs border border-[#333] text-zinc-300 hover:bg-[#2e2e32]"
                            >
                              {t('sortDesc')}
                            </button>
                          </div>
                          <div className="space-y-2">
                            <SelectField
                              value={columnMenu.draft.operator}
                              onChange={(e) =>
                                setColumnMenu((prev) => ({
                                  ...prev,
                                  draft: { ...prev.draft, operator: e.target.value },
                                }))
                              }
                              className={`${selectClass} px-2 py-1.5 text-xs`}
                            >
                              {getFilterOperatorOptions(col).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </SelectField>
                            {isTemporalColumn(col) ? (
                              <TemporalInputField
                                type="datetime-local"
                                value={columnMenu.draft.value}
                                onChange={(e) =>
                                  setColumnMenu((prev) => ({
                                    ...prev,
                                    draft: { ...prev.draft, value: e.target.value },
                                  }))
                                }
                                className={`w-full bg-[#18181b] border border-[#333] rounded px-2 py-1.5 text-xs text-zinc-200 ${tc.focusRing}`}
                              />
                            ) : (
                              <input
                                type={isNumericColumn(col) ? 'number' : 'text'}
                                value={columnMenu.draft.value}
                                onChange={(e) =>
                                  setColumnMenu((prev) => ({
                                    ...prev,
                                    draft: { ...prev.draft, value: e.target.value },
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') applyColumnFilter(col.name);
                                }}
                                placeholder={t('valuePlaceholder')}
                                className={`w-full bg-[#18181b] border border-[#333] rounded px-2 py-1.5 text-xs text-zinc-200 ${tc.focusRing}`}
                              />
                            )}
                          </div>
                          <div className="flex justify-between gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => clearColumnFilter(col.name)}
                              className="px-2 py-1.5 rounded text-xs border border-[#333] text-zinc-300 hover:bg-[#2e2e32]"
                            >
                              {t('clearFilter')}
                            </button>
                            <button
                              type="button"
                              onClick={() => applyColumnFilter(col.name)}
                              className={`px-2 py-1.5 rounded text-xs text-white ${tc.bg} ${tc.hoverBg}`}
                            >
                              {t('apply')}
                            </button>
                          </div>
                        </>
                      ) : null}
                    </MenuSurface>
                  </th>
                );
              })}
              <th className="px-4 py-2 font-normal w-[140px] border-b border-[#2e2e32] sticky right-0 z-20 bg-[#1c1c1c]" />
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {shouldVirtualizeRows && virtualWindow.topPadding > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={dataColumnSpan}
                  style={{ height: `${virtualWindow.topPadding}px` }}
                  className="p-0 border-0"
                />
              </tr>
            )}
            {tableRows.map((row, index) => {
              const absoluteIndex = virtualWindow.startIndex + index;

              return (
                <tr
                  key={row._origIndex}
                  className={`border-b border-[#2e2e32] group transition-colors ${selectedRows.has(row._origIndex) ? 'bg-zinc-800/50' : 'hover:bg-[#232323]/60'}`}
                >
                  <td
                    className={`px-3 py-1.5 border-r border-[#2e2e32] text-zinc-600 text-xs sticky left-0 z-[12] shadow-[inset_-1px_0_0_rgba(46,46,50,1)] ${selectedRows.has(row._origIndex) ? 'bg-zinc-800/70' : 'bg-[#18181b] group-hover:bg-[#232323]'} ${currentTableData.type !== 'view' ? 'cursor-pointer' : ''}`}
                    onClick={
                      currentTableData.type !== 'view'
                        ? () => toggleRowSelection(row._origIndex)
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {currentTableData.type !== 'view' && selectedRows.has(row._origIndex) && (
                        <span
                          className={`inline-flex items-center justify-center w-4 h-4 rounded border ${tc.border} ${tc.textLight} ${tc.lightBg}`}
                        >
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                      <span className={selectedRows.has(row._origIndex) ? tc.textLight : ''}>
                        {rowOffset + absoluteIndex + 1}
                      </span>
                    </div>
                  </td>

                  {visibleColumns.map((col) => {
                    const cellMeta = cellMetaByRow.get(row._origIndex)?.[col.name];
                    const rawValue = cellMeta?.rawValue ?? row[col.name];
                    const cellTextValue = cellMeta?.cellTextValue ?? getCellTextValue(rawValue);
                    const timestampTooltip =
                      cellMeta?.timestampTooltip ?? getTimestampTooltip(rawValue, col);
                    const hoverTooltip = cellMeta?.hoverTooltip ?? '';
                    const jsonPreview =
                      cellMeta?.jsonPreview ??
                      (isJsonColumn(col) ? formatJsonCellValue(rawValue) : '');
                    const isEditingThisCell =
                      editingCell?.rowIndex === row._origIndex && editingCell?.colName === col.name;
                    const pinned = isColumnPinned(col.name);
                    const pinnedLeft = pinnedLeftOffsets[col.name];
                    const pinnedBackground = selectedRows.has(row._origIndex)
                      ? 'bg-zinc-800/70'
                      : 'bg-[#18181b] group-hover:bg-[#232323]';

                    return (
                      <td
                        key={col.name}
                        data-testid="table-cell"
                        data-row-index={String(row._origIndex)}
                        data-column-name={col.name}
                        onDoubleClick={() =>
                          currentTableData.type !== 'view' &&
                          setEditingCell({
                            rowIndex: row._origIndex,
                            colName: col.name,
                            value: row[col.name],
                          })
                        }
                        className={`px-4 py-1 border-r border-[#2e2e32] last:border-r-0 max-w-[250px] relative group/cell cursor-text ${
                          pinned
                            ? `sticky ${pinnedBackground} shadow-[inset_-1px_0_0_rgba(46,46,50,1)]`
                            : ''
                        }`}
                        style={
                          pinned && pinnedLeft !== undefined
                            ? { left: `${pinnedLeft}px`, zIndex: 6 }
                            : undefined
                        }
                        title={showCellTooltipOnHover ? timestampTooltip || undefined : undefined}
                      >
                        <div
                          onContextMenu={(event) =>
                            onCellContextMenu(event, row._origIndex, col, rawValue)
                          }
                          className="w-full"
                        >
                          {isEditingThisCell ? (
                            <input
                              data-testid="inline-edit-input"
                              autoFocus
                              value={editingCell.value == null ? '' : String(editingCell.value)}
                              onChange={(e) =>
                                setEditingCell((prev) =>
                                  prev ? { ...prev, value: e.target.value } : prev,
                                )
                              }
                              onBlur={() => saveInlineEdit(editingCell)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                              }}
                              className={`w-full bg-[#18181b] border ${tc.border} rounded px-1 py-0.5 text-sm text-zinc-200 outline-none shadow-lg`}
                            />
                          ) : (
                            <HoverTooltip content={hoverTooltip}>
                              <div className="truncate w-full block">
                                {cellMeta?.renderedValue ?? renderCellContent(row, col)}
                              </div>
                            </HoverTooltip>
                          )}
                        </div>
                        <div
                          className={`absolute right-1 top-1/2 -translate-y-1/2 flex gap-1 bg-[#18181b] p-0.5 rounded shadow-lg border border-[#333] transition-opacity ${jsonPreview ? 'opacity-100' : 'opacity-0 group-hover/cell:opacity-100'}`}
                        >
                          {jsonPreview && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalConfig({
                                  isOpen: true,
                                  type: 'json_viewer',
                                  data: { columnName: col.name, value: rawValue },
                                });
                              }}
                              className={`text-[10px] font-semibold ${tc.textLight} px-1.5 py-1 rounded hover:bg-[#333] transition-colors`}
                              title={t('viewJson')}
                            >
                              JSON
                            </button>
                          )}
                          {!isEditingThisCell && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(cellTextValue);
                              }}
                              className="text-zinc-500 hover:text-white p-1 rounded hover:bg-[#333] transition-colors"
                              title={t('copy')}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  <td
                    className={`px-4 py-1.5 text-right sticky right-0 z-10 border-l border-[#2e2e32] ${selectedRows.has(row._origIndex) ? 'bg-zinc-800/70' : 'bg-[#18181b] group-hover:bg-[#232323]'}`}
                  >
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyRowWithHeaders(row)}
                        className="text-zinc-500 hover:text-zinc-200"
                        title={t('copy')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setFormData({ ...row });
                          setRowDetailsTab('details');
                          setModalConfig({
                            isOpen: true,
                            type: 'row_form',
                            editIndex: row._origIndex,
                            viewOnly: true,
                          });
                        }}
                        className="text-zinc-500 hover:text-blue-400"
                        title={t('rowDetails')}
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      {currentTableData.type !== 'view' && (
                        <>
                          <button
                            onClick={() => handleCloneRow(row._origIndex)}
                            className="text-zinc-500 hover:text-zinc-200"
                            title={t('duplicateTable')}
                          >
                            <CopyPlus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setFormData({ ...row });
                              setRowDetailsTab('details');
                              setModalConfig({
                                isOpen: true,
                                type: 'row_form',
                                editIndex: row._origIndex,
                                viewOnly: false,
                              });
                            }}
                            className="text-zinc-500 hover:text-zinc-300"
                            title={t('editRow')}
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRow(row._origIndex)}
                            className="text-zinc-500 hover:text-red-400"
                            title={t('drop')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {shouldVirtualizeRows && virtualWindow.bottomPadding > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={dataColumnSpan}
                  style={{ height: `${virtualWindow.bottomPadding}px` }}
                  className="p-0 border-0"
                />
              </tr>
            )}
          </tbody>
        </table>
        {paginatedData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">{hasDataFilters ? t('noFilterResults') : t('noRecords')}</p>
          </div>
        )}
      </div>

      <div className="bg-[#1c1c1c] border-t border-[#2e2e32] p-2 px-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{t('rowsPerPage')}</span>
          <SelectField
            wrapperClassName="w-auto min-w-[72px]"
            data-testid="table-rows-per-page"
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
            className={`${selectClass} w-full px-2 py-1 text-xs`}
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </SelectField>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span data-testid="table-pagination-range" className="text-zinc-400">
            {currentPageRowCount > 0 ? (safePage - 1) * safeRowsPerPage + 1 : 0} -{' '}
            {currentPageRowCount > 0 ? (safePage - 1) * safeRowsPerPage + currentPageRowCount : 0} /{' '}
            {effectiveTotalRows}
          </span>
          <div className="flex gap-1">
            <button
              data-testid="table-pagination-first"
              onClick={() => setPage(1)}
              disabled={!canGoPrevPage}
              className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
            >
              <ChevronFirst className="w-4 h-4" />
            </button>
            <button
              data-testid="table-pagination-prev"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={!canGoPrevPage}
              className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              data-testid="table-pagination-next"
              onClick={() => setPage((prev) => Math.min(effectiveTotalPages, prev + 1))}
              disabled={!canGoNextPage}
              className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              data-testid="table-pagination-last"
              onClick={() => setPage(effectiveTotalPages)}
              disabled={!canGoNextPage}
              className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
            >
              <ChevronLast className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
