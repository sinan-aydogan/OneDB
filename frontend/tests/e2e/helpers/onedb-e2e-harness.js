import { expect } from '@playwright/test';

export const SOFT_DB_COLOR_CLASSES = [
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

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const stripIdentifier = (value) =>
  String(value || '')
    .trim()
    .replace(/^([`"])(.*)\1$/, '$2');

const parseSqlLiteral = (token) => {
  const raw = String(token || '').trim();
  if (/^null$/i.test(raw)) return null;

  if (/^'.*'$/.test(raw)) {
    return raw.slice(1, -1).replace(/''/g, "'");
  }

  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  return raw;
};

const parseJsonSafely = (request) => {
  const body = request.postData();
  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const compareValues = (left, right) => {
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;

  const leftNum = Number(left);
  const rightNum = Number(right);
  const bothNumeric = Number.isFinite(leftNum) && Number.isFinite(rightNum);
  if (bothNumeric) {
    if (leftNum === rightNum) return 0;
    return leftNum < rightNum ? -1 : 1;
  }

  const leftText = String(left).toLowerCase();
  const rightText = String(right).toLowerCase();
  if (leftText === rightText) return 0;
  return leftText < rightText ? -1 : 1;
};

const normalizeFilterValue = (value) => (value == null ? '' : String(value));

const applyFilters = (rows, filters) => {
  if (!Array.isArray(filters) || filters.length === 0) return rows;

  return rows.filter((row) =>
    filters.every((filter) => {
      const column = String(filter?.column || '').trim();
      const operator = String(filter?.operator || 'contains').toLowerCase();
      const expectedRaw = filter?.value;
      const actualRaw = row?.[column];

      const actualText = normalizeFilterValue(actualRaw).toLowerCase();
      const expectedText = normalizeFilterValue(expectedRaw).toLowerCase();

      if (operator === 'contains') return actualText.includes(expectedText);
      if (operator === 'starts_with') return actualText.startsWith(expectedText);
      if (operator === 'ends_with') return actualText.endsWith(expectedText);

      const cmp = compareValues(actualRaw, expectedRaw);
      if (operator === 'eq') return cmp === 0;
      if (operator === 'neq') return cmp !== 0;
      if (operator === 'gt') return cmp > 0;
      if (operator === 'gte') return cmp >= 0;
      if (operator === 'lt') return cmp < 0;
      if (operator === 'lte') return cmp <= 0;
      return true;
    }),
  );
};

const applySorting = (rows, sort) => {
  if (!sort || typeof sort !== 'object') return rows;
  const column = String(sort.column || '').trim();
  if (!column) return rows;
  const direction = String(sort.direction || 'asc').toLowerCase() === 'desc' ? -1 : 1;

  const nextRows = [...rows];
  nextRows.sort((a, b) => compareValues(a?.[column], b?.[column]) * direction);
  return nextRows;
};

const createRows = (count, mapper) =>
  Array.from({ length: count }, (_, index) => mapper(index + 1));

export const createDefaultMockData = () => ({
  call_trend_analyzer: {
    sessions: {
      type: 'table',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, nullable: 'No' },
        { name: 'user_name', type: 'varchar(191)', isPrimary: false, nullable: 'No' },
        { name: 'status', type: 'varchar(50)', isPrimary: false, nullable: 'No' },
        { name: 'created_at', type: 'datetime', isPrimary: false, nullable: 'No' },
      ],
      rows: createRows(15, (id) => ({
        id,
        user_name: `caller_${id}`,
        status: id % 2 === 0 ? 'queued' : 'ready',
        created_at: `2026-04-${String((id % 28) + 1).padStart(2, '0')} 10:00:00`,
      })),
    },
    ai_helper_settings: {
      type: 'table',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, nullable: 'No' },
        { name: 'setting_key', type: 'varchar(191)', isPrimary: false, nullable: 'No' },
        { name: 'setting_value', type: 'text', isPrimary: false, nullable: 'Yes' },
      ],
      rows: [
        { id: 1, setting_key: 'temperature', setting_value: '0.2' },
        { id: 2, setting_key: 'model', setting_value: 'gpt-5.4-mini' },
      ],
    },
    sessions_view: {
      type: 'view',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, nullable: 'No' },
        { name: 'status', type: 'varchar(50)', isPrimary: false, nullable: 'No' },
      ],
      rows: [
        { id: 1, status: 'ready' },
        { id: 2, status: 'queued' },
      ],
    },
  },
  nefix: {
    users: {
      type: 'table',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, nullable: 'No' },
        { name: 'name', type: 'varchar(191)', isPrimary: false, nullable: 'No' },
        { name: 'email', type: 'varchar(191)', isPrimary: false, nullable: 'No' },
      ],
      rows: createRows(40, (id) => ({
        id,
        name: `User ${id}`,
        email: `user${id}@nefix.test`,
      })),
    },
    client_deals: {
      type: 'table',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, nullable: 'No' },
        { name: 'client_name', type: 'varchar(191)', isPrimary: false, nullable: 'No' },
        { name: 'status', type: 'varchar(50)', isPrimary: false, nullable: 'No' },
      ],
      rows: createRows(22, (id) => ({
        id,
        client_name: `Client ${id}`,
        status: id % 3 === 0 ? 'won' : 'open',
      })),
    },
    bulk_upload_logs: {
      type: 'table',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, nullable: 'No' },
        { name: 'file_name', type: 'varchar(191)', isPrimary: false, nullable: 'No' },
      ],
      rows: createRows(8, (id) => ({
        id,
        file_name: `upload_${id}.csv`,
      })),
    },
  },
});

const listTableEntries = (dbRecord) =>
  Object.entries(dbRecord || {}).map(([name, table]) => ({
    name,
    type: table?.type === 'view' ? 'view' : 'table',
    columnCount: Array.isArray(table?.columns) ? table.columns.length : 0,
  }));

const formatColumns = (table) =>
  (Array.isArray(table?.columns) ? table.columns : []).map((column) => ({
    name: String(column.name || ''),
    type: String(column.type || ''),
    extra: String(column.extra || ''),
    isPrimary: Boolean(column.isPrimary),
    nullable: String(column.nullable || 'Yes'),
    isForeign: Boolean(column.isForeign),
    foreignTable: column.foreignTable ?? null,
    foreignCol: column.foreignCol ?? null,
  }));

const executeUpdate = (table, sql) => {
  const updateMatch = String(sql || '').match(
    /^\s*update\s+([`"\w]+)\s+set\s+(.+?)\s+where\s+(.+?)\s*;?\s*$/i,
  );
  if (!updateMatch || !table) return 0;

  const setRaw = updateMatch[2];
  const whereRaw = updateMatch[3];

  const assignments = setRaw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^([`"\w]+)\s*=\s*(.+)$/i);
      if (!m) return null;
      return { column: stripIdentifier(m[1]), value: parseSqlLiteral(m[2]) };
    })
    .filter(Boolean);

  const conditions = whereRaw
    .split(/\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const isNull = part.match(/^([`"\w]+)\s+is\s+null$/i);
      if (isNull) {
        return { column: stripIdentifier(isNull[1]), value: null, isNull: true };
      }
      const eq = part.match(/^([`"\w]+)\s*=\s*(.+)$/i);
      if (!eq) return null;
      return { column: stripIdentifier(eq[1]), value: parseSqlLiteral(eq[2]), isNull: false };
    })
    .filter(Boolean);

  if (assignments.length === 0 || conditions.length === 0 || !Array.isArray(table.rows)) return 0;

  let affectedRows = 0;
  table.rows = table.rows.map((row) => {
    const matches = conditions.every((condition) => {
      const actualValue = row?.[condition.column];
      if (condition.isNull) return actualValue == null;
      return compareValues(actualValue, condition.value) === 0;
    });

    if (!matches) return row;

    const nextRow = { ...row };
    assignments.forEach((assignment) => {
      nextRow[assignment.column] = assignment.value;
    });
    affectedRows += 1;
    return nextRow;
  });

  return affectedRows;
};

const executeQuery = ({ state, databaseName, sql }) => {
  const normalizedSql = String(sql || '').trim();
  const dbRecord = state.databases[databaseName] || {};

  if (/^\s*select\s+count\(\*\)\s+as\s+__onedb_count\s+from\s+/i.test(normalizedSql)) {
    const match = normalizedSql.match(/from\s+([`"\w]+)/i);
    const tableName = stripIdentifier(match?.[1] || '');
    const table = dbRecord[tableName];
    const count = Array.isArray(table?.rows) ? table.rows.length : 0;
    return {
      ok: true,
      kind: 'result_set',
      columns: ['__onedb_count'],
      rows: [{ __onedb_count: count }],
      rowCount: 1,
      durationMs: 1,
      truncated: false,
      maxRows: 1000,
    };
  }

  if (
    /information_schema\.tables/i.test(normalizedSql) ||
    /pg_total_relation_size/i.test(normalizedSql)
  ) {
    return {
      ok: true,
      kind: 'result_set',
      columns: ['mb'],
      rows: [{ mb: 64.25 }],
      rowCount: 1,
      durationMs: 1,
      truncated: false,
      maxRows: 1000,
    };
  }

  if (/^\s*update\s+/i.test(normalizedSql)) {
    const tableMatch = normalizedSql.match(/^\s*update\s+([`"\w]+)/i);
    const tableName = stripIdentifier(tableMatch?.[1] || '');
    const table = dbRecord[tableName];
    const affectedRows = executeUpdate(table, normalizedSql);
    return {
      ok: true,
      kind: 'mutation',
      affectedRows,
      durationMs: 1,
    };
  }

  if (/^\s*select\s+\*\s+from\s+/i.test(normalizedSql)) {
    const tableMatch = normalizedSql.match(/from\s+([`"\w]+)/i);
    const tableName = stripIdentifier(tableMatch?.[1] || '');
    const table = dbRecord[tableName];
    const limitMatch = normalizedSql.match(/limit\s+(\d+)/i);
    const limit = Number(limitMatch?.[1] || 50);
    const rows = (table?.rows || []).slice(0, Number.isFinite(limit) ? limit : 50);
    const columns = formatColumns(table).map((column) => column.name);
    return {
      ok: true,
      kind: 'result_set',
      columns,
      rows: deepClone(rows),
      rowCount: rows.length,
      durationMs: 1,
      truncated: false,
      maxRows: 1000,
    };
  }

  if (/^\s*select\s+1\s*;?\s*$/i.test(normalizedSql)) {
    return {
      ok: true,
      kind: 'result_set',
      columns: ['1'],
      rows: [{ 1: 1 }],
      rowCount: 1,
      durationMs: 1,
      truncated: false,
      maxRows: 1000,
    };
  }

  if (/^\s*select\s+/i.test(normalizedSql)) {
    return {
      ok: true,
      kind: 'result_set',
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 1,
      truncated: false,
      maxRows: 1000,
    };
  }

  return {
    ok: true,
    kind: 'mutation',
    affectedRows: 0,
    durationMs: 1,
  };
};

export async function installOneDbApiMock(page, options = {}) {
  const state = {
    csrfToken: 'e2e-csrf-token',
    databases: deepClone(options.databases || createDefaultMockData()),
    calls: {
      actions: [],
      browseTable: [],
      query: [],
    },
    browseOverrides: options.browseOverrides || {},
  };

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    let action = url.searchParams.get('api');

    if (!action && url.pathname.startsWith('/api/')) {
      action = url.pathname.substring(5); // Extract action after /api/
    }

    if (!action) {
      await route.continue();
      return;
    }

    const method = route.request().method();
    const payload = method === 'GET' ? {} : parseJsonSafely(route.request());
    state.calls.actions.push({ action, method, payload });

    const respond = async (body, status = 200) => {
      await route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(body),
      });
    };

    if (action === 'csrf') {
      await respond({ ok: true, token: state.csrfToken });
      return;
    }

    if (action === 'ping') {
      await respond({ ok: true, time: new Date().toISOString(), php: '8.3.0', readonly: false });
      return;
    }

    if (action === 'upload_limits') {
      await respond({
        ok: true,
        limits: {
          maxUploadBytes: 20 * 1024 * 1024,
          maxFileCount: 10,
        },
      });
      return;
    }

    if (action === 'test_connection') {
      await respond({ ok: true, message: 'Connection successful.' });
      return;
    }

    if (action === 'list_databases') {
      await respond({ ok: true, databases: Object.keys(state.databases).sort() });
      return;
    }

    if (action === 'list_tables') {
      const databaseName = String(payload?.connection?.database || '').trim();
      const dbRecord = state.databases[databaseName] || {};
      await respond({ ok: true, tables: listTableEntries(dbRecord) });
      return;
    }

    if (action === 'browse_table') {
      const databaseName = String(payload?.connection?.database || '').trim();
      const tableName = String(payload?.table || '').trim();
      const dbRecord = state.databases[databaseName] || {};
      const table = dbRecord[tableName];

      const safePerPage = Math.max(1, Number(payload?.perPage || 25));
      const safePage = Math.max(1, Number(payload?.page || 1));
      const includeRowCount = payload?.includeRowCount !== false;

      const baseRows = deepClone(Array.isArray(table?.rows) ? table.rows : []);
      const filteredRows = applySorting(applyFilters(baseRows, payload?.filters), payload?.sort);

      const offset = (safePage - 1) * safePerPage;
      const pageRows = filteredRows.slice(offset, offset + safePerPage);
      const hasMore = offset + safePerPage < filteredRows.length;

      let response = {
        ok: true,
        kind: 'browse_table',
        columns: formatColumns(table),
        rows: pageRows,
        rowCount: includeRowCount ? filteredRows.length : null,
        hasMore,
        page: safePage,
        perPage: safePerPage,
        durationMs: 1,
        insights: payload?.includeInsights
          ? {
              indexes: [],
              foreignKeys: [],
              referencedBy: [],
              viewDefinition: table?.type === 'view' ? `SELECT * FROM ${tableName}` : null,
              relatedRoutines: [],
            }
          : null,
      };

      const overrideKey = `${databaseName}.${tableName}`;
      const override = state.browseOverrides[overrideKey];
      if (typeof override === 'function') {
        const overridden = override({ payload, response: deepClone(response) });
        if (overridden && typeof overridden === 'object') {
          response = { ...response, ...overridden };
        }
      } else if (override && typeof override === 'object') {
        response = { ...response, ...override };
      }

      state.calls.browseTable.push({
        databaseName,
        tableName,
        payload,
        response: deepClone(response),
      });

      await respond(response);
      return;
    }

    if (action === 'query') {
      const databaseName = String(payload?.connection?.database || '').trim();
      const sql = String(payload?.sql || '');
      const queryResponse = executeQuery({ state, databaseName, sql });

      state.calls.query.push({
        databaseName,
        sql,
        response: deepClone(queryResponse),
      });

      await respond(queryResponse);
      return;
    }

    if (action === 'query_transaction') {
      const databaseName = String(payload?.connection?.database || '').trim();
      const statements = Array.isArray(payload?.statements) ? payload.statements : [];
      let affectedRows = 0;
      let executedStatements = 0;

      statements.forEach((statement) => {
        const result = executeQuery({ state, databaseName, sql: statement });
        executedStatements += 1;
        if (result?.kind === 'mutation') {
          affectedRows += Number(result.affectedRows || 0);
        }
      });

      await respond({
        ok: true,
        kind: 'transaction',
        executedStatements,
        affectedRows,
        durationMs: 1,
      });
      return;
    }

    await respond({ ok: true });
  });

  return state;
}

export async function connectToWorkspace(page, connection = {}) {
  await page.goto('/');
  await expect(page.getByTestId('connect-button')).toBeVisible();

  if (connection.host) {
    await page.getByTestId('login-host-input').fill(connection.host);
  }
  if (connection.user) {
    await page.getByTestId('login-user-input').fill(connection.user);
  }
  if (connection.pass) {
    await page.getByTestId('login-pass-input').fill(connection.pass);
  }

  await page.getByTestId('connect-button').click();
  await expect(page.getByTestId('workspace-root')).toBeVisible();
  await expect(page.getByTestId('sidebar-root')).toBeVisible();
}

export async function openSidebarTable(page, dbName, tableName, mode = 'transient') {
  const dbEntry = page.locator(
    `[data-testid="sidebar-db-entry"][data-db-name="${dbName}"][data-entry-source="database-list"]`,
  );
  await expect(dbEntry).toBeVisible();
  await dbEntry.click();

  const tableEntry = page.locator(
    `[data-testid="sidebar-table-entry"][data-db-name="${dbName}"][data-table-name="${tableName}"]`,
  );
  await expect(tableEntry).toBeVisible();

  if (mode === 'permanent') {
    await tableEntry.dblclick();
  } else {
    await tableEntry.click();
  }

  await expect(page.getByTestId('table-browser-view')).toBeVisible();
}

export const getTab = (page, dbName, tableName) =>
  page.locator(
    `[data-testid="table-tab"][data-db-name="${dbName}"][data-table-name="${tableName}"]`,
  );
