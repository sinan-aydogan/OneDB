import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Code,
  Columns,
  FileDown,
  Filter,
  Plus,
  SlidersHorizontal,
  Timer,
  UploadCloud,
  X,
  Trash2,
  Rows,
  Pin,
  Eye,
  Search,
  Settings,
  MoreVertical,
  RotateCcw,
  GripVertical,
} from 'lucide-react';
import ToggleSwitch from '../shared/ToggleSwitch.jsx';
import MenuSurface from '../shared/MenuSurface.jsx';
import SelectField from '../shared/SelectField.jsx';
import TemporalInputField from '../shared/TemporalInputField.jsx';

const DB_LABEL_COLOR_CLASSES = [
  'text-amber-100',
  'text-sky-100',
  'text-emerald-100',
  'text-rose-100',
  'text-violet-100',
  'text-cyan-100',
  'text-lime-100',
  'text-orange-100',
  'text-indigo-100',
  'text-teal-100',
];

function getDbColorClass(dbName) {
  const normalized = String(dbName || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return DB_LABEL_COLOR_CLASSES[0];
  }

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return DB_LABEL_COLOR_CLASSES[hash % DB_LABEL_COLOR_CLASSES.length];
}

export default function TableTabsToolbar({
  t,
  tc,
  settings,
  currentTableData,
  activeTab,
  onChangeTab,
  openTableTabs,
  activeTableTabId,
  onActivateTableTab,
  onCloseTableTab,
  onCloseOtherTableTabs,
  onCloseTableTabsToRight,
  onCloseAllTableTabs,
  onToggleTableTabPin,
  onPromoteTableTab,
  onMoveTableTab,
  isTableTabPinned,
  activeDb,
  activeTable,
  selectedRows,
  onOpenAddRowModal,
  onBulkDelete,
  onExportSqlSelection,
  onToggleFilterPanel,
  tableFilterButtonRef,
  isFilterPanelOpen,
  filterRuleDrafts,
  updateFilterRuleDraft,
  removeFilterRuleDraft,
  currentColumns,
  getFilterOperatorOptions,
  isTemporalColumn,
  isNumericColumn,
  baseSelectClass,
  baseFieldClass,
  addFilterRuleDraft,
  clearAllColumnFilters,
  activeColumnFilterCount,
  applyFilterRuleDrafts,
  appliedServerFilterEntries,
  activeRuleFilters,
  tableColumnsButtonRef,
  isColsPanelOpen,
  setIsColsPanelOpen,
  hiddenColumns,
  toggleColumnVisibility,
  onOpenImportModal,
  onOpenExportModal,
  autoRefreshButtonRef,
  autoRefreshInt,
  isAutoRefreshMenuOpen,
  setIsAutoRefreshMenuOpen,
  setAutoRefreshInt,
  moveColumn,
  onResetColumnOrder,
  onResetColumnFilters,
  orderedColumns,
}) {
  const colorizeDbLabelsByDatabase = settings?.tabs?.colorizeDbLabelsByDatabase === true;
  const tableTabs = useMemo(
    () =>
      openTableTabs && openTableTabs.length > 0
        ? openTableTabs
        : activeDb && activeTable
          ? [{ id: `${activeDb}::${activeTable}`, dbName: activeDb, tableName: activeTable }]
          : [],
    [openTableTabs, activeDb, activeTable],
  );
  const shouldShowTableTabs = tableTabs.length > 1;
  const tabsScrollRef = useRef(null);
  const tabButtonRefs = useRef({});
  const tabRectsRef = useRef(new Map());
  const suppressTabClickRef = useRef(false);
  const lastDragPreviewKeyRef = useRef('');
  const [tabContextMenu, setTabContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    tabId: null,
  });
  const [pointerDrag, setPointerDrag] = useState(null);
  const [draggingTabId, setDraggingTabId] = useState(null);
  const [tabDropIndicator, setTabDropIndicator] = useState(null);
  const tabById = useMemo(
    () =>
      tableTabs.reduce((map, tab) => {
        map[tab.id] = tab;
        return map;
      }, {}),
    [tableTabs],
  );
  const contextTab = useMemo(
    () => tableTabs.find((tab) => tab.id === tabContextMenu.tabId) || null,
    [tableTabs, tabContextMenu.tabId],
  );

  // Column management local state
  const [columnSearchQuery, setColumnSearchQuery] = useState('');
  const [columnShowOnlyVisible, setColumnShowOnlyVisible] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [dropTargetColumn, setDropTargetColumn] = useState(null);

  const filteredColumns = useMemo(() => {
    let cols = orderedColumns || currentColumns || [];
    if (columnSearchQuery) {
      const q = columnSearchQuery.toLowerCase();
      cols = cols.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (columnShowOnlyVisible) {
      cols = cols.filter((c) => !hiddenColumns.has(c.name));
    }
    return cols;
  }, [orderedColumns, currentColumns, columnSearchQuery, columnShowOnlyVisible, hiddenColumns]);
  const draggedTab = useMemo(
    () => (draggingTabId ? tabById[draggingTabId] || null : null),
    [draggingTabId, tabById],
  );

  const [columnSearchQuery, setColumnSearchQuery] = useState('');
  const [columnShowOnlyVisible, setColumnShowOnlyVisible] = useState(false);
  const [columnOptionsMenuOpen, setColumnOptionsMenuOpen] = useState(false);
  const columnOptionsButtonRef = useRef(null);
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [dropTargetColumn, setDropTargetColumn] = useState(null);

  const displayColumns = useMemo(() => {
    let cols = orderedColumns || [];
    if (columnShowOnlyVisible) {
      cols = cols.filter((col) => !hiddenColumns.has(col.name));
    }
    if (columnSearchQuery.trim()) {
      const q = columnSearchQuery.toLowerCase();
      cols = cols.filter((col) => col.name.toLowerCase().includes(q));
    }
    return cols;
  }, [orderedColumns, columnShowOnlyVisible, columnSearchQuery, hiddenColumns]);
  const dragGhostStyle = useMemo(() => {
    if (!pointerDrag || !draggedTab || !draggingTabId) return null;
    return {
      left: `${Math.round(pointerDrag.currentX - pointerDrag.offsetX)}px`,
      top: `${Math.round(pointerDrag.currentY - pointerDrag.offsetY)}px`,
      width: `${Math.round(pointerDrag.width)}px`,
      minWidth: `${Math.round(pointerDrag.width)}px`,
      maxWidth: `${Math.round(pointerDrag.width)}px`,
    };
  }, [draggingTabId, draggedTab, pointerDrag]);

  const getDbLabelClass = (tab, isActive) =>
    colorizeDbLabelsByDatabase
      ? `${getDbColorClass(tab.dbName)} ${isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`
      : isActive
        ? 'text-zinc-200'
        : 'text-zinc-500 group-hover:text-zinc-300';

  useEffect(() => {
    if (!tabContextMenu.visible) {
      return undefined;
    }

    const close = () => setTabContextMenu((prev) => ({ ...prev, visible: false }));
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tabContextMenu.visible]);

  useEffect(() => {
    if (!shouldShowTableTabs || !activeTableTabId) return;
    const activeNode = tabButtonRefs.current[activeTableTabId];
    const scrollNode = tabsScrollRef.current;
    if (!activeNode || !scrollNode) return;

    const timeoutId = window.setTimeout(() => {
      activeNode.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeTableTabId, shouldShowTableTabs, tableTabs]);

  useLayoutEffect(() => {
    const nextRects = new Map();
    tableTabs.forEach((tab) => {
      const node = tabButtonRefs.current[tab.id];
      if (!node) return;
      nextRects.set(tab.id, node.getBoundingClientRect());
    });

    nextRects.forEach((nextRect, tabId) => {
      if (tabId === draggingTabId) return;
      const prevRect = tabRectsRef.current.get(tabId);
      const node = tabButtonRefs.current[tabId];
      if (!prevRect || !node) return;
      const deltaX = prevRect.left - nextRect.left;
      const deltaY = prevRect.top - nextRect.top;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

      node.style.transition = 'none';
      node.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      requestAnimationFrame(() => {
        node.style.transition = 'transform 170ms cubic-bezier(0.2, 0, 0, 1)';
        node.style.transform = '';
      });
    });

    tabRectsRef.current = nextRects;
  }, [draggingTabId, tableTabs]);

  const openTabContextMenu = (event, tabId) => {
    event.preventDefault();
    event.stopPropagation();
    setTabContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      tabId,
    });
  };

  const closeTabContextMenu = () => {
    setTabContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const clearTabDragState = () => {
    setDraggingTabId(null);
    setTabDropIndicator(null);
    lastDragPreviewKeyRef.current = '';
  };

  const resolvePointerDropTarget = (clientX, draggingId = null) => {
    const positionedTabs = tableTabs
      .map((tab) => {
        if (draggingId && tab.id === draggingId) return null;
        const node = tabButtonRefs.current[tab.id];
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        if (!Number.isFinite(rect.left) || !Number.isFinite(rect.right) || rect.width <= 0) {
          return null;
        }
        return { tabId: tab.id, rect };
      })
      .filter(Boolean);

    if (positionedTabs.length === 0) return null;

    const first = positionedTabs[0];
    const last = positionedTabs[positionedTabs.length - 1];
    if (clientX <= first.rect.left) {
      return { tabId: first.tabId, position: 'before' };
    }
    if (clientX >= last.rect.right) {
      return { tabId: last.tabId, position: 'after' };
    }

    const hovered = positionedTabs.find(
      ({ rect }) => clientX >= rect.left && clientX <= rect.right,
    );
    if (hovered) {
      const midpoint = hovered.rect.left + hovered.rect.width / 2;
      return { tabId: hovered.tabId, position: clientX < midpoint ? 'before' : 'after' };
    }

    let nearest = null;
    for (const entry of positionedTabs) {
      const center = entry.rect.left + entry.rect.width / 2;
      const distance = Math.abs(clientX - center);
      if (!nearest || distance < nearest.distance) {
        nearest = { tabId: entry.tabId, center, distance };
      }
    }

    if (!nearest) return null;
    return {
      tabId: nearest.tabId,
      position: clientX < nearest.center ? 'before' : 'after',
    };
  };

  const autoScrollTabsWhileDragging = (clientX) => {
    const container = tabsScrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const threshold = 48;
    const maxStep = 16;
    if (clientX < rect.left + threshold) {
      const ratio = Math.min(1, (rect.left + threshold - clientX) / threshold);
      container.scrollLeft -= Math.ceil(maxStep * ratio);
    } else if (clientX > rect.right - threshold) {
      const ratio = Math.min(1, (clientX - (rect.right - threshold)) / threshold);
      container.scrollLeft += Math.ceil(maxStep * ratio);
    }
  };

  useEffect(() => {
    if (!pointerDrag) return undefined;
    const DRAG_THRESHOLD_PX = 4;

    const handlePointerMove = (event) => {
      if (event.pointerId !== pointerDrag.pointerId) return;
      const deltaX = event.clientX - pointerDrag.startX;
      const deltaY = event.clientY - pointerDrag.startY;
      setPointerDrag((prev) =>
        prev && prev.pointerId === event.pointerId
          ? { ...prev, currentX: event.clientX, currentY: event.clientY }
          : prev,
      );
      if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX && draggingTabId === null) {
        return;
      }

      if (draggingTabId === null) {
        setDraggingTabId(pointerDrag.tabId);
      }

      suppressTabClickRef.current = true;
      if (event.cancelable) {
        event.preventDefault();
      }

      autoScrollTabsWhileDragging(event.clientX);

      const dragTab = tabById[pointerDrag.tabId];
      if (!dragTab) return;

      const dropTarget = resolvePointerDropTarget(event.clientX, dragTab.id);
      if (!dropTarget || dropTarget.tabId === dragTab.id) {
        setTabDropIndicator(null);
        return;
      }

      const targetTab = tabById[dropTarget.tabId];
      if (!targetTab) return;
      if (Boolean(targetTab.pinned) !== Boolean(dragTab.pinned)) {
        setTabDropIndicator(null);
        return;
      }

      setTabDropIndicator(dropTarget);
      const previewKey = `${dragTab.id}:${dropTarget.tabId}:${dropTarget.position}`;
      if (lastDragPreviewKeyRef.current !== previewKey) {
        onMoveTableTab?.(dragTab.id, dropTarget.tabId, dropTarget.position);
        lastDragPreviewKeyRef.current = previewKey;
      }
    };

    const handlePointerFinish = (event) => {
      if (event.pointerId !== pointerDrag.pointerId) return;
      setPointerDrag(null);
      clearTabDragState();
      window.setTimeout(() => {
        suppressTabClickRef.current = false;
      }, 0);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerFinish);
    window.addEventListener('pointercancel', handlePointerFinish);
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerFinish);
      window.removeEventListener('pointercancel', handlePointerFinish);
      document.body.style.userSelect = '';
    };
  }, [draggingTabId, onMoveTableTab, pointerDrag, tabById, tableTabs]);

  return (
    <div className="px-6 border-b border-[#2e2e32] bg-[#1c1c1c] shrink-0">
      {shouldShowTableTabs && (
        <div
          ref={tabsScrollRef}
          data-testid="table-tabs-list"
          className="flex items-center gap-2 py-2 border-b border-[#252529] overflow-x-auto scrollbar-none"
        >
          {tableTabs.map((tab) => {
            const isActive = tab.id === activeTableTabId;
            const isPinned = Boolean(tab.pinned);
            const dbLabelClass = getDbLabelClass(tab, isActive);
            return (
              <div
                key={tab.id}
                ref={(node) => {
                  if (node) {
                    tabButtonRefs.current[tab.id] = node;
                  } else {
                    delete tabButtonRefs.current[tab.id];
                  }
                }}
                role="button"
                tabIndex={0}
                data-testid="table-tab"
                data-tab-id={tab.id}
                data-db-name={tab.dbName}
                data-table-name={tab.tableName}
                data-active={isActive ? 'true' : 'false'}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  if (tableTabs.length <= 1) return;
                  const target = event.target;
                  if (target instanceof Element && target.closest('button')) return;
                  const node = tabButtonRefs.current[tab.id];
                  if (!node) return;
                  const rect = node.getBoundingClientRect();
                  suppressTabClickRef.current = false;
                  setPointerDrag({
                    tabId: tab.id,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    currentX: event.clientX,
                    currentY: event.clientY,
                    offsetX: event.clientX - rect.left,
                    offsetY: event.clientY - rect.top,
                    width: rect.width,
                    height: rect.height,
                  });
                }}
                onClick={(event) => {
                  if (suppressTabClickRef.current) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }
                  onActivateTableTab(tab.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onActivateTableTab(tab.id);
                  }
                }}
                onDoubleClick={() => onPromoteTableTab?.(tab.id)}
                onContextMenu={(event) => openTabContextMenu(event, tab.id)}
                className={`group relative inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-[colors,transform] whitespace-nowrap select-none ${
                  isActive
                    ? `${tc.border} ${tc.textLight} ${tc.lightBg}`
                    : 'border-[#333] text-zinc-300 hover:bg-[#232323]'
                } ${tab.isTransient ? 'italic' : ''} ${
                  draggingTabId === tab.id
                    ? 'opacity-20 scale-[0.98] cursor-grabbing'
                    : 'cursor-default'
                } ${tabDropIndicator?.tabId === tab.id ? 'ring-1 ring-emerald-300/40' : ''}`}
                title={`${tab.dbName}.${tab.tableName}`}
              >
                {tabDropIndicator?.tabId === tab.id && tabDropIndicator?.position === 'before' && (
                  <span className="pointer-events-none absolute -left-[3px] top-1.5 bottom-1.5 w-[2px] rounded-full bg-emerald-300" />
                )}
                {tabDropIndicator?.tabId === tab.id && tabDropIndicator?.position === 'after' && (
                  <span className="pointer-events-none absolute -right-[3px] top-1.5 bottom-1.5 w-[2px] rounded-full bg-emerald-300" />
                )}
                {isPinned && <Pin className="w-3 h-3 text-amber-400" />}
                {tab.isTransient && <Eye className="w-3 h-3 text-zinc-500" />}
                <span className="max-w-[12rem] truncate">{tab.tableName}</span>
                <span
                  data-testid="table-tab-db-label"
                  className={`text-[10px] transition-colors ${dbLabelClass}`}
                >
                  {tab.dbName}
                </span>
                <button
                  type="button"
                  draggable={false}
                  data-testid="table-tab-close"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseTableTab(tab.id);
                  }}
                  className="text-zinc-500 hover:text-zinc-200 transition-colors"
                  aria-label={t('close')}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          {tabContextMenu.visible && contextTab && (
            <MenuSurface
              open={tabContextMenu.visible}
              point={{ x: tabContextMenu.x, y: tabContextMenu.y, width: 220, height: 250 }}
              className="py-1 z-[140] min-w-[190px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-[#2e2e32] mb-1">
                {contextTab.tableName}
              </div>
              <button
                type="button"
                onClick={() => {
                  onCloseTableTab(contextTab.id);
                  closeTabContextMenu();
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-[#2e2e32] hover:text-white flex items-center gap-2"
              >
                <X className="w-3.5 h-3.5" /> {t('tabClose')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseOtherTableTabs?.(contextTab.id);
                  closeTabContextMenu();
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-[#2e2e32] hover:text-white"
              >
                {t('tabCloseOthers')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseTableTabsToRight?.(contextTab.id);
                  closeTabContextMenu();
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-[#2e2e32] hover:text-white"
              >
                {t('tabCloseRight')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseAllTableTabs?.();
                  closeTabContextMenu();
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-400/10"
              >
                {t('tabCloseAll')}
              </button>
              <div className="my-1 border-t border-[#2e2e32]" />
              <button
                type="button"
                onClick={() => {
                  onToggleTableTabPin?.(contextTab.id);
                  closeTabContextMenu();
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-400/10 flex items-center gap-2"
              >
                <Pin className="w-3.5 h-3.5" />
                {isTableTabPinned?.(contextTab.id) ? t('tabUnpin') : t('tabPin')}
              </button>
            </MenuSurface>
          )}
        </div>
      )}
      {dragGhostStyle && draggedTab && (
        <div className="pointer-events-none fixed z-[180]" style={dragGhostStyle}>
          <div
            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs whitespace-nowrap shadow-[0_10px_30px_rgba(0,0,0,0.45)] ${
              draggedTab.id === activeTableTabId
                ? `${tc.border} ${tc.textLight} ${tc.lightBg}`
                : 'border-[#3b3b40] text-zinc-100 bg-[#202024]'
            }`}
          >
            {draggedTab.pinned && <Pin className="w-3 h-3 text-amber-400" />}
            {draggedTab.isTransient && <Eye className="w-3 h-3 text-zinc-500" />}
            <span className="max-w-[12rem] truncate">{draggedTab.tableName}</span>
            <span
              data-testid="table-tab-drag-db-label"
              className={`text-[10px] ${getDbLabelClass(draggedTab, draggedTab.id === activeTableTabId)}`}
            >
              {draggedTab.dbName}
            </span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1 overflow-x-auto scrollbar-none">
          <div className="flex gap-6 min-w-max">
            <button
              onClick={() => onChangeTab('browse')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'browse' ? `${tc.border} ${tc.textLight}` : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
            >
              <Rows className="w-4 h-4" />{' '}
              {currentTableData.type === 'view' ? t('results') : t('tableEditor')}
            </button>
            <button
              onClick={() => onChangeTab('schema')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'schema' ? `${tc.border} ${tc.textLight}` : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
            >
              <Columns className="w-4 h-4" /> {t('schema')}
            </button>
            <button
              onClick={() => onChangeTab('sql')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sql' ? `${tc.border} ${tc.textLight}` : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
            >
              <Code className="w-4 h-4" /> {t('sqlEditor')}
            </button>
          </div>
        </div>

        {activeTab === 'browse' && (
          <div className="flex items-center gap-2 py-2 shrink-0 overflow-visible">
            {currentTableData.type !== 'view' && (
              <>
                <button
                  onClick={onOpenAddRowModal}
                  className={`${tc.bg} ${tc.hoverBg} text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors`}
                >
                  <Plus className="w-3.5 h-3.5" /> {t('addRow')}
                </button>
                <div className="h-4 w-[1px] bg-[#333] mx-1" />
              </>
            )}

            {selectedRows.size > 0 && currentTableData.type !== 'view' ? (
              <>
                <span className="text-xs text-zinc-400 mx-2">
                  {selectedRows.size} {t('selected')}
                </span>
                <button
                  onClick={onBulkDelete}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t('delSelected')}
                </button>
                <button
                  onClick={onExportSqlSelection}
                  className="bg-[#232323] border border-[#333] hover:bg-[#2e2e32] text-zinc-300 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" /> {t('exportSql')}
                </button>
              </>
            ) : (
              <>
                <div className="relative">
                  <button
                    ref={tableFilterButtonRef}
                    type="button"
                    onClick={onToggleFilterPanel}
                    className={`px-2 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors border ${activeColumnFilterCount > 0 ? `${tc.border} ${tc.textLight} ${tc.lightBg}` : 'border-[#333] text-zinc-400 hover:bg-[#232323]'}`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    {t('filters')}{' '}
                    {activeColumnFilterCount > 0 ? `(${activeColumnFilterCount})` : ''}
                  </button>
                  <MenuSurface
                    open={isFilterPanelOpen}
                    anchor={tableFilterButtonRef}
                    placement="bottom-end"
                    onClick={(e) => e.stopPropagation()}
                    className="p-3 z-[120] w-[28rem]"
                  >
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                      {t('filters')}
                    </div>
                    <div className="space-y-2 max-h-[54vh] overflow-y-auto pr-1">
                      {filterRuleDrafts.length > 0 ? (
                        filterRuleDrafts.map((rule) => {
                          const selectedColumn =
                            (currentColumns || []).find((col) => col.name === rule.column) || null;
                          const operatorOptions = getFilterOperatorOptions(selectedColumn || {});
                          const temporal = isTemporalColumn(selectedColumn || {});
                          return (
                            <div
                              key={rule.id}
                              className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start bg-[#202024] border border-[#333] rounded p-2"
                            >
                              <SelectField
                                value={rule.column}
                                onChange={(event) =>
                                  updateFilterRuleDraft(rule.id, { column: event.target.value })
                                }
                                className={`${baseSelectClass} text-xs px-2 py-1.5`}
                              >
                                {(currentColumns || []).map((col) => (
                                  <option key={col.name} value={col.name}>
                                    {col.name}
                                  </option>
                                ))}
                              </SelectField>
                              <SelectField
                                value={rule.operator}
                                onChange={(event) =>
                                  updateFilterRuleDraft(rule.id, { operator: event.target.value })
                                }
                                className={`${baseSelectClass} text-xs px-2 py-1.5`}
                              >
                                {operatorOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </SelectField>
                              {temporal ? (
                                <TemporalInputField
                                  type="datetime-local"
                                  value={rule.value}
                                  onChange={(event) =>
                                    updateFilterRuleDraft(rule.id, { value: event.target.value })
                                  }
                                  className={`${baseFieldClass} text-xs px-2 py-1.5`}
                                />
                              ) : (
                                <input
                                  type={isNumericColumn(selectedColumn || {}) ? 'number' : 'text'}
                                  value={rule.value}
                                  onChange={(event) =>
                                    updateFilterRuleDraft(rule.id, { value: event.target.value })
                                  }
                                  placeholder={t('valuePlaceholder')}
                                  className={`${baseFieldClass} text-xs px-2 py-1.5`}
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => removeFilterRuleDraft(rule.id)}
                                className="px-2 py-1.5 rounded text-xs border border-[#333] text-zinc-300 hover:bg-[#2e2e32]"
                                title={t('drop')}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-zinc-500 py-2">{t('addRule')}</div>
                      )}
                    </div>
                    <div className="flex justify-between items-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={addFilterRuleDraft}
                        disabled={(currentColumns || []).length === 0}
                        className="px-2 py-1.5 rounded text-xs border border-[#333] text-zinc-300 hover:bg-[#2e2e32] disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        {t('addRule')}
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={clearAllColumnFilters}
                          disabled={activeColumnFilterCount === 0 && filterRuleDrafts.length === 0}
                          className="px-2 py-1.5 rounded text-xs border border-[#333] text-zinc-300 hover:bg-[#2e2e32] disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          {t('clearFilter')}
                        </button>
                        <button
                          type="button"
                          onClick={applyFilterRuleDrafts}
                          className={`px-2 py-1.5 rounded text-xs text-white ${tc.bg} ${tc.hoverBg}`}
                        >
                          {t('apply')}
                        </button>
                      </div>
                    </div>
                    {(appliedServerFilterEntries.length > 0 || activeRuleFilters.length > 0) && (
                      <div className="mt-3 pt-2 border-t border-[#2e2e32] space-y-1 max-h-28 overflow-y-auto">
                        {appliedServerFilterEntries.map(([columnName, filterConfig]) => (
                          <div key={`column-${columnName}`} className="text-[11px] text-zinc-400">
                            <span className="text-zinc-300">{columnName}</span>
                            <span className="text-zinc-500">
                              {' '}
                              {String(filterConfig?.operator || 'contains')}{' '}
                            </span>
                            <span>{String(filterConfig?.value || '')}</span>
                          </div>
                        ))}
                        {activeRuleFilters.map((rule) => (
                          <div key={`rule-${rule.id}`} className="text-[11px] text-zinc-400">
                            <span className="text-zinc-300">{rule.column}</span>
                            <span className="text-zinc-500"> {rule.operator} </span>
                            <span>{rule.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </MenuSurface>
                </div>

                <div className="relative">
                  <button
                    ref={tableColumnsButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsColsPanelOpen(!isColsPanelOpen);
                    }}
                    className={`px-2 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors border ${hiddenColumns.size > 0 ? `${tc.border} ${tc.textLight} ${tc.lightBg}` : 'border-[#333] text-zinc-400 hover:bg-[#232323]'}`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" /> {t('columns')}{' '}
                    {hiddenColumns.size > 0 &&
                      `(${currentColumns.length - hiddenColumns.size}/${currentColumns.length})`}
                  </button>
                  <MenuSurface
                    open={isColsPanelOpen}
                    anchor={tableColumnsButtonRef}
                    placement="bottom-end"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 z-[120] w-64 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                        {t('columns')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mb-2 px-1">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                        <input
                          type="text"
                          autoFocus
                          value={columnSearchQuery}
                          onChange={(e) => setColumnSearchQuery(e.target.value)}
                          placeholder={t('searchColumns')}
                          className="w-full bg-[#18181b] border border-[#333] rounded px-6 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors"
                        />
                        {columnSearchQuery && (
                          <button
                            onClick={() => setColumnSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <button
                          ref={columnOptionsButtonRef}
                          onClick={(e) => {
                            e.stopPropagation();
                            setColumnOptionsMenuOpen(!columnOptionsMenuOpen);
                          }}
                          className={`p-1.5 rounded border transition-colors ${columnOptionsMenuOpen ? `${tc.border} ${tc.textLight} ${tc.lightBg}` : 'border-[#333] text-zinc-400 hover:bg-[#2e2e32] hover:text-zinc-200'}`}
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <MenuSurface
                          open={columnOptionsMenuOpen}
                          anchor={columnOptionsButtonRef}
                          placement="bottom-end"
                          className="p-1 z-[130] w-48 shadow-2xl border-[#333]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="px-2 py-1.5 flex items-center justify-between text-[11px] text-zinc-400 border-b border-[#2e2e32] mb-1">
                            <span>{t('viewSettings')}</span>
                          </div>
                          <div className="px-2 py-1.5 flex items-center justify-between hover:bg-[#2e2e32] rounded transition-colors group">
                            <span className="text-xs text-zinc-300">{t('activeOnly')}</span>
                            <ToggleSwitch
                              checked={columnShowOnlyVisible}
                              onChange={() => setColumnShowOnlyVisible(!columnShowOnlyVisible)}
                              tc={tc}
                              className="scale-75 origin-right"
                            />
                          </div>
                          <button
                            onClick={() => {
                              onResetColumnFilters?.();
                              setColumnShowOnlyVisible(false);
                            }}
                            className="w-full text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-[#2e2e32] rounded transition-colors flex items-center gap-2"
                          >
                            <Eye className="w-3 h-3 text-zinc-500" />
                            {t('showAllColumns')}
                          </button>
                          <div className="h-[1px] bg-[#2e2e32] my-1" />
                          <button
                            onClick={() => {
                              onResetColumnOrder?.();
                              setColumnOptionsMenuOpen(false);
                            }}
                            className="w-full text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-[#2e2e32] rounded transition-colors flex items-center gap-2"
                          >
                            <RotateCcw className="w-3 h-3 text-zinc-500" />
                            {t('resetColumnOrder')}
                          </button>
                        </MenuSurface>
                      </div>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                      {displayColumns.length > 0 ? (
                        displayColumns.map((col) => (
                          <div
                            key={col.name}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('columnName', col.name);
                              setDraggedColumn(col.name);
                            }}
                            onDragEnd={() => {
                              setDraggedColumn(null);
                              setDropTargetColumn(null);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (draggedColumn && draggedColumn !== col.name) {
                                setDropTargetColumn(col.name);
                              }
                            }}
                            onDragLeave={() => {
                              if (dropTargetColumn === col.name) {
                                setDropTargetColumn(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDropTargetColumn(null);
                              const fromName = e.dataTransfer.getData('columnName');
                              if (fromName && fromName !== col.name) {
                                moveColumn(fromName, col.name);
                              }
                            }}
                            className={`flex items-center gap-2 px-1 group transition-colors border-b-2 ${
                              dropTargetColumn === col.name ? `border-b-2 ${tc.border}` : 'border-b-transparent'
                            } ${draggedColumn === col.name ? 'opacity-30' : ''}`}
                          >
                            <div className="cursor-grab active:cursor-grabbing p-1 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>
                            <label className="flex-1 flex items-center gap-2 py-1.5 cursor-pointer text-xs text-zinc-300">
                              <input
                                type="checkbox"
                                checked={!hiddenColumns.has(col.name)}
                                onChange={() => toggleColumnVisibility(col.name)}
                                className={`rounded-sm bg-[#18181b] border-[#444] ${tc.accent}`}
                              />
                              <span className="truncate">{col.name}</span>
                            </label>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center text-zinc-600 text-[11px] italic">
                          {t('noColumnsFound')}
                        </div>
                      )}
                    </div>
                  </MenuSurface>
                </div>
              </>
            )}

            {currentTableData.type !== 'view' && (
              <button
                onClick={onOpenImportModal}
                className="text-zinc-400 hover:text-zinc-200 text-xs flex items-center gap-1.5 px-2 py-1.5 rounded border border-[#333] hover:bg-[#232323] transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5" /> {t('import')}
              </button>
            )}
            <button
              onClick={onOpenExportModal}
              className="text-zinc-400 hover:text-zinc-200 text-xs flex items-center gap-1.5 px-2 py-1.5 rounded border border-[#333] hover:bg-[#232323] transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" /> {t('export')}
            </button>

            <div className="relative">
              <button
                ref={autoRefreshButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAutoRefreshMenuOpen(!isAutoRefreshMenuOpen);
                }}
                className={`text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 rounded flex items-center gap-1 border ${autoRefreshInt > 0 ? `${tc.border} ${tc.textLight} ${tc.lightBg}` : 'border-[#333] hover:bg-[#232323]'}`}
                title={t('autoRefresh')}
              >
                <Timer className="w-4 h-4" />
                {autoRefreshInt > 0 && (
                  <span className="text-[10px] font-bold">{autoRefreshInt}s</span>
                )}
              </button>
              <MenuSurface
                open={isAutoRefreshMenuOpen}
                anchor={autoRefreshButtonRef}
                placement="bottom-end"
                onClick={(e) => e.stopPropagation()}
                className="p-2 z-[120] w-48"
              >
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">
                  {t('autoRefresh')}
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setAutoRefreshInt(0);
                      setIsAutoRefreshMenuOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${autoRefreshInt === 0 ? tc.textLight : 'text-zinc-300 hover:bg-[#2e2e32]'}`}
                  >
                    {t('off')}
                  </button>
                  <button
                    onClick={() => {
                      setAutoRefreshInt(5);
                      setIsAutoRefreshMenuOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${autoRefreshInt === 5 ? tc.textLight : 'text-zinc-300 hover:bg-[#2e2e32]'}`}
                  >
                    {t('sec5')}
                  </button>
                  <button
                    onClick={() => {
                      setAutoRefreshInt(10);
                      setIsAutoRefreshMenuOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${autoRefreshInt === 10 ? tc.textLight : 'text-zinc-300 hover:bg-[#2e2e32]'}`}
                  >
                    {t('sec10')}
                  </button>
                </div>
              </MenuSurface>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
