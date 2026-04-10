import { useCallback } from 'react';

export const shouldIncludeBrowseRowCount = (nextPage, overrideValue) => {
  if (typeof overrideValue === 'boolean') {
    return overrideValue;
  }
  return Math.max(1, Number(nextPage || 1)) === 1;
};

export const resolveBrowseRowCount = ({
  includeRowCount,
  apiRowCount,
  fallbackRowCount,
  hasMore,
  page,
  perPage,
  pageRowsLength,
}) => {
  if (includeRowCount) {
    const parsed = Number(apiRowCount || 0);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  const fallback = Number(fallbackRowCount || 0);
  const safeFallback = Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
  const safePage = Math.max(1, Number(page || 1));
  const safePerPage = Math.max(1, Number(perPage || 1));
  const safePageRowsLength = Math.max(0, Number(pageRowsLength || 0));
  const knownMinimum = (safePage - 1) * safePerPage + safePageRowsLength;
  const inferred = hasMore ? knownMinimum + 1 : knownMinimum;
  if (!hasMore) {
    return knownMinimum;
  }
  return Math.max(safeFallback, inferred);
};

const normalizeResponseSnippet = (payload) =>
  String(payload || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

export const parseApiJson = async (response, action) => {
  const rawPayload = await response.text();
  const trimmedPayload = rawPayload.trim();
  if (trimmedPayload === '') return null;

  try {
    return JSON.parse(trimmedPayload);
  } catch {
    const head = trimmedPayload.slice(0, 20).toLowerCase();
    const looksLikeHtml =
      head.startsWith('<!doctype') || head.startsWith('<html') || head[0] === '<';
    const snippet = normalizeResponseSnippet(trimmedPayload);
    const detail = snippet !== '' ? ` Response starts with: ${snippet}` : '';
    if (looksLikeHtml) {
      throw new Error(
        `Server returned HTML instead of JSON for "${action}" (HTTP ${response.status}).${detail}`,
      );
    }
    throw new Error(`Invalid JSON response for "${action}" (HTTP ${response.status}).${detail}`);
  }
};

export default function useOneDbApi({
  currentDriver,
  connForm,
  csrfTokenRef,
  activeDb,
  activeTable,
  page,
  rowsPerPage,
  sortConfig,
  serverColumnFilters,
  filterRules,
  databases,
  loadedTableDbs,
  loadingTableDbs,
  setDatabases,
  setLoadedTableDbs,
  setLoadingTableDbs,
  setPing,
  setDbSizeLabel,
  escapeLiteral,
}) {
  const buildConnectionPayload = useCallback(
    (database = '') => {
      const host = connForm.host.trim();
      const port = connForm.port.trim();
      const sshTunnelEnabled = Boolean(connForm.sshTunnelEnabled);
      const resolvedHost = sshTunnelEnabled
        ? String(connForm.sshTunnelHost || '').trim() || '127.0.0.1'
        : host;
      const resolvedPort = sshTunnelEnabled ? String(connForm.sshTunnelPort || '').trim() : port;
      const sslEnabled = Boolean(connForm.sslEnabled);

      const ssl = sslEnabled
        ? {
            enabled: true,
            mode: String(connForm.sslMode || '').trim(),
            ca: String(connForm.sslCa || '').trim(),
            cert: String(connForm.sslCert || '').trim(),
            key: String(connForm.sslKey || '').trim(),
            passphrase: String(connForm.sslPassphrase || ''),
          }
        : { enabled: false };

      return {
        driver: currentDriver,
        ...(resolvedHost !== '' ? { host: resolvedHost } : {}),
        ...(resolvedPort !== '' ? { port: resolvedPort } : {}),
        username: connForm.user.trim(),
        password: connForm.pass,
        database: currentDriver === 'pgsql' ? database || 'postgres' : database,
        charset: 'utf8mb4',
        ssl,
        ...(sshTunnelEnabled
          ? {
              ssh_tunnel: {
                enabled: true,
                host: String(connForm.sshTunnelHost || '').trim(),
                port: String(connForm.sshTunnelPort || '').trim(),
              },
            }
          : {}),
        ...(String(connForm.secretRef || '').trim() !== ''
          ? { secret_ref: String(connForm.secretRef || '').trim() }
          : {}),
      };
    },
    [
      connForm.host,
      connForm.pass,
      connForm.port,
      connForm.secretRef,
      connForm.sshTunnelEnabled,
      connForm.sshTunnelHost,
      connForm.sshTunnelPort,
      connForm.sslCa,
      connForm.sslCert,
      connForm.sslEnabled,
      connForm.sslKey,
      connForm.sslMode,
      connForm.sslPassphrase,
      connForm.user,
      currentDriver,
    ],
  );

  const apiActionUrl = useCallback(
    (action) =>
      import.meta.env.DEV
        ? `/api/${encodeURIComponent(action)}`
        : `?api=${encodeURIComponent(action)}`,
    [],
  );

  const quoteIdentifier = useCallback(
    (name) => {
      const value = String(name || '');
      if (currentDriver === 'pgsql') {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return `\`${value.replace(/`/g, '``')}\``;
    },
    [currentDriver],
  );

  const getCsrfToken = useCallback(async () => {
    if (csrfTokenRef.current) return csrfTokenRef.current;
    const res = await fetch(apiActionUrl('csrf'), {
      credentials: 'same-origin',
    });
    const data = await parseApiJson(res, 'csrf');
    if (!res.ok || !data?.ok || !data?.token) {
      throw new Error(data?.error || `Failed to fetch CSRF token (HTTP ${res.status}).`);
    }
    csrfTokenRef.current = data.token;
    return csrfTokenRef.current;
  }, [apiActionUrl, csrfTokenRef]);

  const callApi = useCallback(
    async (action, payload = null, options = {}) => {
      const method = options.method || 'POST';
      const headers = {};
      if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        headers['X-CSRF-Token'] = await getCsrfToken();
      }

      const res = await fetch(apiActionUrl(action), {
        method,
        credentials: 'same-origin',
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(payload || {}),
        signal: options.signal,
      });

      if (options.responseType === 'blob') {
        if (!res.ok) {
          const errorData = await parseApiJson(res, action);
          throw new Error(errorData?.error || `API "${action}" failed (${res.status}).`);
        }
        return await res.blob();
      }

      const data = await parseApiJson(res, action);
      if (!data || typeof data !== 'object') {
        throw new Error(`Invalid API response for "${action}" (HTTP ${res.status}).`);
      }

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `API "${action}" failed (${res.status}).`);
      }
      return data;
    },
    [apiActionUrl, getCsrfToken],
  );

  const executeSql = useCallback(
    async (sql, database = activeDb, options = {}) =>
      callApi(
        'query',
        {
          connection: buildConnectionPayload(database || ''),
          sql,
        },
        options,
      ),
    [activeDb, buildConnectionPayload, callApi],
  );

  const executeSqlTransactionBatch = useCallback(
    async (statements, database = activeDb, options = {}) =>
      callApi(
        'query_transaction',
        {
          connection: buildConnectionPayload(database || ''),
          statements: Array.isArray(statements) ? statements : [],
        },
        options,
      ),
    [activeDb, buildConnectionPayload, callApi],
  );

  const getFirstValue = useCallback((row) => {
    if (!row || typeof row !== 'object') return null;
    const values = Object.values(row);
    return values.length > 0 ? values[0] : null;
  }, []);

  const listDatabases = useCallback(async () => {
    const result = await callApi('list_databases', {
      connection: buildConnectionPayload(''),
    });

    return (result.databases || []).map((dbName) => String(dbName || '').trim()).filter(Boolean);
  }, [buildConnectionPayload, callApi]);

  const refreshSchemas = useCallback(
    async (databaseNames) => {
      const dbNames = Array.isArray(databaseNames) ? databaseNames : await listDatabases();
      setDatabases((prev) => {
        const next = {};
        dbNames.forEach((dbName) => {
          next[dbName] = prev[dbName] || {};
        });
        return next;
      });
      setLoadedTableDbs((prev) =>
        Object.keys(prev).reduce((next, dbName) => {
          if (dbNames.includes(dbName)) next[dbName] = prev[dbName];
          return next;
        }, {}),
      );

      return dbNames;
    },
    [listDatabases, setDatabases, setLoadedTableDbs],
  );

  const preloadTableRowCounts = useCallback(
    async (dbName, tableEntries = []) => {
      const targets = tableEntries.filter(
        (entry) =>
          entry &&
          typeof entry.name === 'string' &&
          entry.name.trim() !== '' &&
          String(entry.type || 'table').toLowerCase() !== 'view',
      );
      if (!dbName || targets.length === 0) return;

      const CHUNK_SIZE = 4;
      for (let start = 0; start < targets.length; start += CHUNK_SIZE) {
        const chunk = targets.slice(start, start + CHUNK_SIZE);
        const chunkCounts = new Map();
        await Promise.all(
          chunk.map(async (entry) => {
            try {
              const result = await callApi('query', {
                connection: buildConnectionPayload(dbName),
                sql: `SELECT COUNT(*) AS __onedb_count FROM ${quoteIdentifier(entry.name)};`,
              });
              const row = Array.isArray(result?.rows) ? result.rows[0] : null;
              const rawValue =
                row && typeof row === 'object'
                  ? (row.__onedb_count ?? Object.values(row)[0])
                  : result?.rowCount;
              const parsedCount = Number(rawValue);
              if (!Number.isFinite(parsedCount) || parsedCount < 0) return;
              chunkCounts.set(entry.name, parsedCount);
            } catch {
              // Keep previous value when row count cannot be fetched.
            }
          }),
        );

        if (chunkCounts.size === 0) continue;

        setDatabases((prev) => {
          const dbRecord = prev[dbName];
          if (!dbRecord) return prev;
          let changed = false;
          const nextDbRecord = { ...dbRecord };

          chunkCounts.forEach((parsedCount, tableName) => {
            const tableRecord = dbRecord[tableName];
            if (!tableRecord) return;
            if (tableRecord.rowCount === parsedCount && tableRecord.rowCountLoaded) return;
            changed = true;
            nextDbRecord[tableName] = {
              ...tableRecord,
              rowCount: parsedCount,
              rowCountLoaded: true,
            };
          });

          if (!changed) return prev;
          return {
            ...prev,
            [dbName]: nextDbRecord,
          };
        });
      }
    },
    [buildConnectionPayload, callApi, quoteIdentifier, setDatabases],
  );

  const ensureDatabaseTablesLoaded = useCallback(
    async (dbName, options = {}) => {
      if (!dbName) return [];
      if (loadedTableDbs[dbName] && !options.force) {
        return Object.values(databases[dbName] || {});
      }
      if (loadingTableDbs[dbName] && !options.force) {
        return [];
      }
      const shouldPreloadRowCounts = !options.skipRowCountPreload;

      setLoadingTableDbs((prev) => ({ ...prev, [dbName]: true }));
      try {
        const result = await callApi('list_tables', {
          connection: buildConnectionPayload(dbName),
        });
        const entries = (result.tables || [])
          .map((row) => ({
            name: String(row.name || '').trim(),
            type: String(row.type || '').toLowerCase() === 'view' ? 'view' : 'table',
            columnCount: Number(row.columnCount || 0),
          }))
          .filter((entry) => entry.name !== '');

        const previousDbEntry = databases[dbName] || {};
        const rowCountTargets = entries.filter((entry) => {
          if (options.force) return true;
          return !previousDbEntry[entry.name]?.rowCountLoaded;
        });

        setDatabases((prev) => {
          const prevDb = prev[dbName] || {};
          const nextDb = {};

          entries.forEach((entry) => {
            const currentEntry = prevDb[entry.name];
            nextDb[entry.name] = currentEntry
              ? { ...currentEntry, type: entry.type, columnCount: entry.columnCount }
              : {
                  type: entry.type,
                  columns: [],
                  data: [],
                  rowCount: null,
                  rowCountLoaded: false,
                  columnCount: entry.columnCount,
                  loaded: false,
                  page: 1,
                  perPage: rowsPerPage,
                  hasMore: false,
                };
          });

          return {
            ...prev,
            [dbName]: nextDb,
          };
        });
        setLoadedTableDbs((prev) => ({ ...prev, [dbName]: true }));
        if (shouldPreloadRowCounts) {
          void preloadTableRowCounts(dbName, rowCountTargets);
        }

        return entries;
      } finally {
        setLoadingTableDbs((prev) => ({ ...prev, [dbName]: false }));
      }
    },
    [
      buildConnectionPayload,
      callApi,
      databases,
      loadedTableDbs,
      loadingTableDbs,
      preloadTableRowCounts,
      rowsPerPage,
      setDatabases,
      setLoadedTableDbs,
      setLoadingTableDbs,
    ],
  );

  const buildBrowseFilters = useCallback(
    (filtersMap = serverColumnFilters, rulesList = filterRules) => {
      const columnFilters = Object.entries(filtersMap || {}).reduce(
        (list, [column, filterConfig]) => {
          if (!filterConfig || typeof filterConfig !== 'object') return list;
          const value = String(filterConfig?.value ?? '').trim();
          if (value === '') return list;
          list.push({
            column,
            operator: filterConfig?.operator || 'contains',
            value,
          });
          return list;
        },
        [],
      );

      const extraRules = (Array.isArray(rulesList) ? rulesList : []).reduce((list, rule) => {
        if (!rule || typeof rule !== 'object') return list;
        const column = String(rule.column || '').trim();
        const operator = String(rule.operator || 'contains').trim() || 'contains';
        const value = String(rule.value ?? '').trim();

        if (column === '' || value === '') return list;
        list.push({ column, operator, value });
        return list;
      }, []);

      return [...columnFilters, ...extraRules];
    },
    [filterRules, serverColumnFilters],
  );

  const loadTableDetails = useCallback(
    async (dbName, tableName, overrides = {}) => {
      if (!dbName || !tableName) return null;

      const nextPage = overrides.page ?? page;
      const nextPerPage = overrides.perPage ?? rowsPerPage;
      const includeRowCount = shouldIncludeBrowseRowCount(nextPage, overrides.includeRowCount);
      const hasInsights = Boolean(databases?.[dbName]?.[tableName]?.insightsLoaded);
      const includeInsights =
        typeof overrides.includeInsights === 'boolean' ? overrides.includeInsights : !hasInsights;
      const nextSort = overrides.sort ?? (sortConfig.key ? sortConfig : null);
      const nextColumnFilters = overrides.columnFilters ?? serverColumnFilters;
      const nextRuleFilters = overrides.ruleFilters ?? filterRules;
      const tableType = String(databases?.[dbName]?.[tableName]?.type || 'table').toLowerCase();
      const result = await callApi('browse_table', {
        connection: buildConnectionPayload(dbName),
        table: tableName,
        tableType,
        page: nextPage,
        perPage: nextPerPage,
        includeRowCount,
        includeInsights,
        sort: nextSort?.key ? { column: nextSort.key, direction: nextSort.direction } : null,
        filters: buildBrowseFilters(nextColumnFilters, nextRuleFilters),
      });

      const rows = (result.rows || []).map((row, index) => ({ ...row, _origIndex: index }));
      const columns = result.columns || [];

      setDatabases((prev) => {
        const dbEntry = prev[dbName] || {};
        const currentEntry = dbEntry[tableName] || { type: 'table' };
        const rowCount = resolveBrowseRowCount({
          includeRowCount,
          apiRowCount: result.rowCount,
          fallbackRowCount: currentEntry.rowCount,
          hasMore: Boolean(result.hasMore),
          page: Number(result.page || nextPage),
          perPage: Number(result.perPage || nextPerPage),
          pageRowsLength: rows.length,
        });
        return {
          ...prev,
          [dbName]: {
            ...dbEntry,
            [tableName]: {
              ...currentEntry,
              columns,
              data: rows,
              rowCount,
              rowCountLoaded: includeRowCount || Boolean(currentEntry.rowCountLoaded),
              columnCount: columns.length,
              insights: includeInsights ? result.insights || null : currentEntry.insights || null,
              insightsLoaded:
                includeInsights || Boolean(currentEntry.insightsLoaded || result.insights),
              loaded: true,
              page: Number(result.page || nextPage),
              perPage: Number(result.perPage || nextPerPage),
              hasMore: Boolean(result.hasMore),
            },
          },
        };
      });

      return result;
    },
    [
      buildBrowseFilters,
      buildConnectionPayload,
      callApi,
      databases,
      filterRules,
      page,
      rowsPerPage,
      serverColumnFilters,
      setDatabases,
      sortConfig,
    ],
  );

  const refreshActiveTable = useCallback(async () => {
    if (!activeDb || !activeTable) return;
    await loadTableDetails(activeDb, activeTable);
  }, [activeDb, activeTable, loadTableDetails]);

  const refreshPing = useCallback(async () => {
    const started = performance.now();
    await callApi('ping', null, { method: 'GET' });
    const elapsed = Math.max(1, Math.round(performance.now() - started));
    setPing(elapsed);
    return elapsed;
  }, [callApi, setPing]);

  const refreshDatabaseSize = useCallback(
    async (dbName) => {
      if (!dbName) {
        setDbSizeLabel('--');
        return;
      }

      const sizeSql =
        currentDriver === 'pgsql'
          ? "SELECT ROUND(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))) / 1024 / 1024.0, 2) AS mb FROM pg_tables WHERE schemaname = 'public';"
          : `SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS mb FROM information_schema.tables WHERE table_schema = ${escapeLiteral(dbName)};`;

      try {
        const result = await executeSql(sizeSql, dbName);
        const mb = Number(getFirstValue(result.rows?.[0]));
        if (Number.isFinite(mb)) {
          setDbSizeLabel(`${mb.toFixed(2)} MB`);
        } else {
          setDbSizeLabel('--');
        }
      } catch {
        setDbSizeLabel('--');
      }
    },
    [currentDriver, escapeLiteral, executeSql, getFirstValue, setDbSizeLabel],
  );

  return {
    buildConnectionPayload,
    getCsrfToken,
    callApi,
    executeSql,
    executeSqlTransactionBatch,
    getFirstValue,
    listDatabases,
    refreshSchemas,
    ensureDatabaseTablesLoaded,
    buildBrowseFilters,
    loadTableDetails,
    refreshActiveTable,
    refreshPing,
    refreshDatabaseSize,
  };
}
