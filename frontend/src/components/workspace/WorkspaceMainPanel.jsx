import React from 'react';
import { Command, Database } from 'lucide-react';
import DatabaseOverview from './DatabaseOverview.jsx';
import SchemaView from './SchemaView.jsx';
import SqlEditorView from './SqlEditorView.jsx';
import TableBrowserView from './TableBrowserView.jsx';
import TableTabsToolbar from './TableTabsToolbar.jsx';

export default function WorkspaceMainPanel({
  t,
  tc,
  currentTableData,
  activeTab,
  setActiveTab,
  openTableTabs,
  activeTableTabId,
  activateTableTab,
  closeTableTab,
  closeOtherTableTabs,
  closeTableTabsToRight,
  closeAllTableTabs,
  toggleTableTabPin,
  moveTableTab,
  moveColumn,
  orderedColumns,
  onResetColumnOrder,
  onResetColumnFilters,
  isTableTabPinned,
  selectedRows,
  setFormData,
  setRowDetailsTab,
  setModalConfig,
  handleBulkDelete,
  handleExportTable,
  toggleFilterPanelFromToolbar,
  tableFilterButtonRef,
  isFilterPanelOpen,
  setIsFilterPanelOpen,
  filterRuleDrafts,
  updateFilterRuleDraft,
  removeFilterRuleDraft,
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
  pinnedColumnNames,
  isColumnPinned,
  toggleColumnPin,
  autoRefreshButtonRef,
  autoRefreshInt,
  isAutoRefreshMenuOpen,
  setIsAutoRefreshMenuOpen,
  setAutoRefreshInt,
  visibleColumns,
  paginatedData,
  page,
  rowsPerPage,
  setRowsPerPage,
  setPage,
  totalPages,
  processedData,
  serverColumnFilters,
  sortConfig,
  setSortConfig,
  openColumnMenu,
  columnMenu,
  setColumnMenu,
  applyColumnFilter,
  clearColumnFilter,
  getColumnIcon,
  toggleAllRows,
  toggleRowSelection,
  renderCellContent,
  getCellTextValue,
  getTimestampTooltip,
  showCellTooltipOnHover,
  isJsonColumn,
  formatJsonCellValue,
  copyToClipboard,
  editingCell,
  setEditingCell,
  saveInlineEdit,
  handleCloneRow,
  handleDeleteRow,
  handleDropColumn,
  copyRowWithHeaders,
  openCellContextMenu,
  activeTable,
  schemaViewMode,
  setSchemaViewMode,
  currentTableDdl,
  sqlContainerRef,
  sqlResult,
  sqlEditorHeight,
  settings,
  handleAiGenerate,
  aiPrompt,
  setAiPrompt,
  isAiLoading,
  quoteIdentifier,
  setSqlQuery,
  formatSql,
  saveSnippet,
  setHistoryTab,
  runSql,
  cancelRunningSql,
  beginTransactionDraft,
  commitTransactionDraft,
  rollbackTransactionDraft,
  isQueryRunning,
  transactionDraftActive,
  transactionDraftStatements,
  sqlQuery,
  handleSqlKeyDown,
  handleSplitterMouseDown,
  sqlResultTab,
  setSqlResultTab,
  exportToCSV,
  activeDb,
  cpuUsage,
  dbSizeLabel,
  qps,
  loadingTableDbs,
  databases,
  selectDbAndTable,
  setInputVal,
  setIsCommandOpen,
  moveColumn,
  resetColumnOrder,
  resetColumnFilters,
  orderedColumns,
}) {
  if (currentTableData) {
    return (
      <>
        <TableTabsToolbar
          t={t}
          tc={tc}
          settings={settings}
          currentTableData={currentTableData}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          openTableTabs={openTableTabs}
          activeTableTabId={activeTableTabId}
          onActivateTableTab={activateTableTab}
          onCloseTableTab={closeTableTab}
          onCloseOtherTableTabs={closeOtherTableTabs}
          onCloseTableTabsToRight={closeTableTabsToRight}
          onCloseAllTableTabs={closeAllTableTabs}
          onToggleTableTabPin={toggleTableTabPin}
          onMoveTableTab={moveTableTab}
          isTableTabPinned={isTableTabPinned}
          moveColumn={moveColumn}
          orderedColumns={orderedColumns}
          onResetColumnOrder={onResetColumnOrder}
          onResetColumnFilters={onResetColumnFilters}
          activeDb={activeDb}
          activeTable={activeTable}
          selectedRows={selectedRows}
          onOpenAddRowModal={() => {
            setFormData({});
            setRowDetailsTab('details');
            setModalConfig({ isOpen: true, type: 'row_form', editIndex: -1, viewOnly: false });
          }}
          onBulkDelete={handleBulkDelete}
          onExportSqlSelection={() => handleExportTable('sql')}
          onToggleFilterPanel={toggleFilterPanelFromToolbar}
          tableFilterButtonRef={tableFilterButtonRef}
          isFilterPanelOpen={isFilterPanelOpen}
          filterRuleDrafts={filterRuleDrafts}
          updateFilterRuleDraft={updateFilterRuleDraft}
          removeFilterRuleDraft={removeFilterRuleDraft}
          currentColumns={currentTableData.columns || []}
          getFilterOperatorOptions={getFilterOperatorOptions}
          isTemporalColumn={isTemporalColumn}
          isNumericColumn={isNumericColumn}
          baseSelectClass={baseSelectClass}
          baseFieldClass={baseFieldClass}
          addFilterRuleDraft={addFilterRuleDraft}
          clearAllColumnFilters={clearAllColumnFilters}
          activeColumnFilterCount={activeColumnFilterCount}
          applyFilterRuleDrafts={applyFilterRuleDrafts}
          appliedServerFilterEntries={appliedServerFilterEntries}
          activeRuleFilters={activeRuleFilters}
          tableColumnsButtonRef={tableColumnsButtonRef}
          isColsPanelOpen={isColsPanelOpen}
          setIsColsPanelOpen={setIsColsPanelOpen}
          hiddenColumns={hiddenColumns}
          toggleColumnVisibility={toggleColumnVisibility}
          onOpenImportModal={() => setModalConfig({ isOpen: true, type: 'import' })}
          onOpenExportModal={() => setModalConfig({ isOpen: true, type: 'export' })}
          autoRefreshButtonRef={autoRefreshButtonRef}
          autoRefreshInt={autoRefreshInt}
          isAutoRefreshMenuOpen={isAutoRefreshMenuOpen}
          setIsAutoRefreshMenuOpen={setIsAutoRefreshMenuOpen}
          setAutoRefreshInt={setAutoRefreshInt}
          moveColumn={moveColumn}
          onResetColumnOrder={resetColumnOrder}
          onResetColumnFilters={resetColumnFilters}
          orderedColumns={orderedColumns}
        />

        <div className="flex-1 overflow-auto flex flex-col bg-[#18181b]">
          {activeTab === 'browse' && (
            <TableBrowserView
              t={t}
              tc={tc}
              currentTableData={currentTableData}
              visibleColumns={visibleColumns}
              hiddenColumns={hiddenColumns}
              toggleColumnVisibility={toggleColumnVisibility}
              pinnedColumnNames={pinnedColumnNames}
              isColumnPinned={isColumnPinned}
              toggleColumnPin={toggleColumnPin}
              moveColumn={moveColumn}
              isColsPanelOpen={isColsPanelOpen}
              setIsColsPanelOpen={setIsColsPanelOpen}
              selectedRows={selectedRows}
              paginatedData={paginatedData}
              page={page}
              rowsPerPage={rowsPerPage}
              setRowsPerPage={setRowsPerPage}
              setPage={setPage}
              totalPages={totalPages}
              processedData={processedData}
              activeColumnFilterCount={activeColumnFilterCount}
              hasDataFilters={activeColumnFilterCount > 0}
              isFilterPanelOpen={isFilterPanelOpen}
              setIsFilterPanelOpen={setIsFilterPanelOpen}
              serverColumnFilters={serverColumnFilters}
              clearAllColumnFilters={clearAllColumnFilters}
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
              openColumnMenu={openColumnMenu}
              columnMenu={columnMenu}
              setColumnMenu={setColumnMenu}
              getFilterOperatorOptions={getFilterOperatorOptions}
              isNumericColumn={isNumericColumn}
              isTemporalColumn={isTemporalColumn}
              applyColumnFilter={applyColumnFilter}
              clearColumnFilter={clearColumnFilter}
              getColumnIcon={getColumnIcon}
              toggleAllRows={toggleAllRows}
              toggleRowSelection={toggleRowSelection}
              renderCellContent={renderCellContent}
              getCellTextValue={getCellTextValue}
              getTimestampTooltip={getTimestampTooltip}
              showCellTooltipOnHover={showCellTooltipOnHover}
              isJsonColumn={isJsonColumn}
              formatJsonCellValue={formatJsonCellValue}
              copyToClipboard={copyToClipboard}
              editingCell={editingCell}
              setEditingCell={setEditingCell}
              saveInlineEdit={saveInlineEdit}
              setModalConfig={setModalConfig}
              setFormData={setFormData}
              setRowDetailsTab={setRowDetailsTab}
              handleBulkDelete={handleBulkDelete}
              handleExportTable={handleExportTable}
              handleCloneRow={handleCloneRow}
              handleDeleteRow={handleDeleteRow}
              copyRowWithHeaders={copyRowWithHeaders}
              onCellContextMenu={openCellContextMenu}
              moveColumn={moveColumn}
              showToolbar={false}
            />
          )}

          {activeTab === 'schema' && (
            <SchemaView
              t={t}
              tc={tc}
              activeTable={activeTable}
              currentTableData={currentTableData}
              schemaViewMode={schemaViewMode}
              setSchemaViewMode={setSchemaViewMode}
              onAddColumn={() => setModalConfig({ isOpen: true, type: 'add_column' })}
              getColumnIcon={getColumnIcon}
              ddl={currentTableDdl}
              copyToClipboard={copyToClipboard}
              onDropColumn={handleDropColumn}
            />
          )}

          {activeTab === 'sql' && (
            <SqlEditorView
              t={t}
              tc={tc}
              sqlContainerRef={sqlContainerRef}
              sqlResult={sqlResult}
              sqlEditorHeight={sqlEditorHeight}
              currentTableData={currentTableData}
              settings={settings}
              handleAiGenerate={handleAiGenerate}
              aiPrompt={aiPrompt}
              setAiPrompt={setAiPrompt}
              isAiLoading={isAiLoading}
              quoteIdentifier={quoteIdentifier}
              activeTable={activeTable}
              setSqlQuery={setSqlQuery}
              formatSql={formatSql}
              saveSnippet={saveSnippet}
              openSqlHistory={() => {
                setHistoryTab('history');
                setModalConfig({ isOpen: true, type: 'sql_history' });
              }}
              runSql={runSql}
              cancelRunningSql={cancelRunningSql}
              beginTransactionDraft={beginTransactionDraft}
              commitTransactionDraft={commitTransactionDraft}
              rollbackTransactionDraft={rollbackTransactionDraft}
              isQueryRunning={isQueryRunning}
              transactionDraftActive={transactionDraftActive}
              transactionDraftStatements={transactionDraftStatements}
              sqlQuery={sqlQuery}
              handleSqlKeyDown={handleSqlKeyDown}
              handleSplitterMouseDown={handleSplitterMouseDown}
              sqlResultTab={sqlResultTab}
              setSqlResultTab={setSqlResultTab}
              exportToCSV={exportToCSV}
              copyToClipboard={copyToClipboard}
            />
          )}
        </div>
      </>
    );
  }

  if (activeDb) {
    return (
      <DatabaseOverview
        t={t}
        tc={tc}
        activeDb={activeDb}
        cpuUsage={cpuUsage}
        dbSizeLabel={dbSizeLabel}
        qps={qps}
        loadingTableDbs={loadingTableDbs}
        databases={databases}
        selectDbAndTable={selectDbAndTable}
        openImportDb={() => setModalConfig({ isOpen: true, type: 'import_db' })}
        openExportDb={() => setModalConfig({ isOpen: true, type: 'export_db' })}
        openCreateTable={() => {
          setInputVal('');
          setModalConfig({ isOpen: true, type: 'create_table', data: { dbName: activeDb } });
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-6 text-center">
      <Database className="w-12 h-12 mb-4 opacity-20" />
      <h2 className="text-lg text-zinc-300 mb-1">{t('selectDb')}</h2>
      <p className="text-sm">{t('selectDbDesc')}</p>
      <button
        onClick={() => setIsCommandOpen(true)}
        className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#232323] hover:bg-[#2e2e32] border border-[#333] rounded-md text-sm transition-colors text-zinc-300 shadow-sm min-w-0 max-w-full"
      >
        <Command className="w-4 h-4 shrink-0" />
        <span className="truncate">{t('openCmd')}</span>
        <kbd className="font-mono text-[10px] bg-[#18181b] px-1.5 py-0.5 rounded text-zinc-500 border border-[#333] shrink-0 whitespace-nowrap">
          ⌘/Ctrl+K
        </kbd>
      </button>
    </div>
  );
}
