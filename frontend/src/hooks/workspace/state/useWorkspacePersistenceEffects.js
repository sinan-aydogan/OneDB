import { useEffect } from 'react';

function getLocalStorage() {
  if (typeof localStorage === 'undefined' || localStorage == null) {
    return null;
  }
  return localStorage;
}

function safeSetItem(key, value) {
  const storage = getLocalStorage();
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore quota/private mode failures.
  }
}

function safeRemoveItem(key) {
  const storage = getLocalStorage();
  if (!storage || typeof storage.removeItem !== 'function') return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore quota/private mode failures.
  }
}

function scheduleSetItem(key, value, delay = 120) {
  const timerId = setTimeout(() => safeSetItem(key, value), delay);
  return () => clearTimeout(timerId);
}

export default function useWorkspacePersistenceEffects({
  lang,
  theme,
  settings,
  sqlHistory,
  sqlSnippets,
  sidebarWidth,
  pinnedItems,
  savedConnections,
  databaseVisibility,
  openTableTabs,
  activeTableTabId,
  pinnedColumnsByTable,
  columnOrderByTable,
}) {
  useEffect(() => {
    safeSetItem('dbm_lang', lang);
  }, [lang]);

  useEffect(() => {
    safeSetItem('dbm_theme', theme);
  }, [theme]);

  useEffect(() => {
    return scheduleSetItem('dbm_settings', JSON.stringify(settings), 150);
  }, [settings]);

  useEffect(() => {
    return scheduleSetItem('dbm_sql_history', JSON.stringify(sqlHistory), 180);
  }, [sqlHistory]);

  useEffect(() => {
    return scheduleSetItem('dbm_sql_snippets', JSON.stringify(sqlSnippets), 180);
  }, [sqlSnippets]);

  useEffect(() => {
    return scheduleSetItem('dbm_sidebar_w', String(sidebarWidth), 120);
  }, [sidebarWidth]);

  useEffect(() => {
    return scheduleSetItem('dbm_pinned', JSON.stringify(pinnedItems), 150);
  }, [pinnedItems]);

  useEffect(() => {
    return scheduleSetItem('dbm_connections', JSON.stringify(savedConnections), 150);
  }, [savedConnections]);

  useEffect(() => {
    return scheduleSetItem('dbm_database_visibility', JSON.stringify(databaseVisibility), 150);
  }, [databaseVisibility]);

  useEffect(() => {
    return scheduleSetItem('dbm_open_table_tabs', JSON.stringify(openTableTabs), 150);
  }, [openTableTabs]);

  useEffect(() => {
    if (activeTableTabId) {
      return scheduleSetItem('dbm_active_table_tab', activeTableTabId, 100);
    }
    safeRemoveItem('dbm_active_table_tab');
  }, [activeTableTabId]);

  useEffect(() => {
    return scheduleSetItem('dbm_pinned_columns', JSON.stringify(pinnedColumnsByTable || {}), 150);
  }, [pinnedColumnsByTable]);

  useEffect(() => {
    return scheduleSetItem('dbm_column_order', JSON.stringify(columnOrderByTable || {}), 150);
  }, [columnOrderByTable]);
}
