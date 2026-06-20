const fs = require("fs");
const Database = require("better-sqlite3");
const path = require("path");
const { hashPassword } = require("../utils/password");

function resolveDbPath() {
  const configured = process.env.FLEETOS_DB_PATH || path.join(__dirname, "..", "data.db");
  return path.resolve(configured);
}

function ensureDatabaseWritable(dbPath) {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  try {
    fs.accessSync(dir, fs.constants.W_OK);
  } catch {
    throw new Error(`Veritabanı dizini yazılabilir değil: ${dir}`);
  }

  [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`].forEach((filePath) => {
    if (!fs.existsSync(filePath)) return;
    try {
      fs.accessSync(filePath, fs.constants.W_OK);
    } catch {
      try {
        fs.chmodSync(filePath, 0o644);
      } catch {
        throw new Error(`Veritabanı dosyası salt okunur: ${filePath}`);
      }
    }
  });
}

const DB_PATH = resolveDbPath();
ensureDatabaseWritable(DB_PATH);

const db = new Database(DB_PATH, { readonly: false, fileMustExist: false, timeout: 10000 });
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 10000");
db.pragma("foreign_keys = ON");
db.pragma("query_only = OFF");

try {
  db.prepare("BEGIN IMMEDIATE").run();
  db.prepare("ROLLBACK").run();
} catch (e) {
  throw new Error(`Veritabanı yazılabilir değil (${DB_PATH}): ${e.message}`);
}

function assertConnectionWritable(context = "işlem") {
  if (db.readonly) {
    throw new Error(`Veritabanı bağlantısı salt okunur (${context}): ${DB_PATH}`);
  }
  try {
    db.prepare("BEGIN IMMEDIATE").run();
    db.prepare("ROLLBACK").run();
  } catch (e) {
    throw new Error(`Veritabanı yazılamıyor (${context}, ${DB_PATH}): ${e.message}`);
  }
}

function runMigrations() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate TEXT,
      brand TEXT,
      model TEXT,
      year TEXT,
      km INTEGER,
      type TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      type TEXT,
      category TEXT,
      amount INTEGER,
      note TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS maintenance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      amount INTEGER DEFAULT 0,
      km INTEGER,
      service_date TEXT,
      next_service_date TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      title TEXT,
      due_date TEXT,
      done_date TEXT,
      cost INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending'
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS fuel_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      liter REAL NOT NULL,
      price_per_liter REAL,
      total_amount INTEGER NOT NULL,
      km INTEGER,
      station TEXT,
      fuel_date TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      liters REAL,
      total_cost INTEGER,
      date TEXT
    )
  `).run();

  [
    "ALTER TABLE vehicles ADD COLUMN type TEXT",
    "ALTER TABLE vehicles ADD COLUMN km INTEGER",
    "ALTER TABLE vehicles ADD COLUMN brand TEXT",
    "ALTER TABLE vehicles ADD COLUMN model TEXT",
    "ALTER TABLE vehicles ADD COLUMN year TEXT",
    "ALTER TABLE transactions ADD COLUMN vehicle_id INTEGER",
    "ALTER TABLE transactions ADD COLUMN category TEXT",
    "ALTER TABLE maintenance_records ADD COLUMN description TEXT",
    "ALTER TABLE maintenance_records ADD COLUMN amount INTEGER DEFAULT 0",
    "ALTER TABLE maintenance_records ADD COLUMN service_date TEXT",
    "ALTER TABLE maintenance_records ADD COLUMN next_service_date TEXT",
    "ALTER TABLE maintenance_records ADD COLUMN title TEXT",
    "ALTER TABLE maintenance_records ADD COLUMN due_date TEXT",
    "ALTER TABLE maintenance_records ADD COLUMN done_date TEXT",
    "ALTER TABLE maintenance_records ADD COLUMN cost INTEGER DEFAULT 0",
    "ALTER TABLE maintenance_records ADD COLUMN status TEXT DEFAULT 'pending'",
    "ALTER TABLE fuel_records ADD COLUMN liter REAL",
    "ALTER TABLE fuel_records ADD COLUMN total_amount INTEGER",
    "ALTER TABLE fuel_records ADD COLUMN fuel_date TEXT",
    "ALTER TABLE fuel_records ADD COLUMN liters REAL",
    "ALTER TABLE fuel_records ADD COLUMN total_cost INTEGER",
    "ALTER TABLE fuel_records ADD COLUMN date TEXT",
    "ALTER TABLE fuel_records ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE maintenance_records ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  ].forEach((sql) => {
    try {
      db.prepare(sql).run();
    } catch (e) {}
  });

  migrateFuelImportSchema();
  migrateHgsImportSchema();
  migrateHakedisImportSchema();
  migrateExpenseCategories();
  migrateIncomeCategories();
  migrateAuditLogs();
  migrateVehicleCurrentKm();
  migrateVehiclePlateNormalized();
  migrateVehicleDocuments();
  migrateComplianceCenterV1();
  migrateMaintenanceCenterV1();
  migrateMaintenanceSchedulerV1();
  migrateMaintenanceAlertsV1();
  migrateComplianceNotificationsV1();
  migrateSubcontractors();
  migrateEmployees();
  migratePayrollObligations();
  migratePayrollAllocations();
  migrateLegacyColumns();
  seedDefaultAdmin();
  backfillMaintenanceFromTransactions();
}

/** Yakıt Excel içe aktarma — mevcut kayıtlar korunur */
function migrateFuelImportSchema() {
  [
    "ALTER TABLE fuel_records ADD COLUMN plate_text TEXT",
    "ALTER TABLE fuel_records ADD COLUMN fuel_type TEXT",
    "ALTER TABLE fuel_records ADD COLUMN city TEXT",
    "ALTER TABLE fuel_records ADD COLUMN distributor TEXT",
    "ALTER TABLE fuel_records ADD COLUMN utts TEXT",
    "ALTER TABLE fuel_records ADD COLUMN transaction_no TEXT",
    "ALTER TABLE fuel_records ADD COLUMN invoice_no TEXT",
    "ALTER TABLE fuel_records ADD COLUMN invoice_date TEXT",
    "ALTER TABLE fuel_records ADD COLUMN source_file TEXT",
    "ALTER TABLE fuel_records ADD COLUMN import_batch_id INTEGER",
    "ALTER TABLE fuel_records ADD COLUMN dedup_key TEXT",
    "ALTER TABLE transactions ADD COLUMN fuel_record_id INTEGER",
  ].forEach((sql) => {
    try {
      db.prepare(sql).run();
    } catch (e) {}
  });

  db.prepare(`
    CREATE TABLE IF NOT EXISTS fuel_import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      format TEXT,
      total_rows INTEGER DEFAULT 0,
      imported INTEGER DEFAULT 0,
      skipped_dup INTEGER DEFAULT 0,
      unmatched INTEGER DEFAULT 0,
      total_liters REAL DEFAULT 0,
      total_amount INTEGER DEFAULT 0,
      saved_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const vehicleCol = db
    .prepare("PRAGMA table_info(fuel_records)")
    .all()
    .find((c) => c.name === "vehicle_id");
  if (vehicleCol && vehicleCol.notnull === 1) {
    rebuildFuelRecordsNullable();
  }

  try {
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_dedup ON fuel_records(dedup_key) WHERE dedup_key IS NOT NULL AND dedup_key != ''`
    ).run();
  } catch (e) {}

  migrateFuelImportReconciliation();
}

function migrateFuelImportReconciliation() {
  [
    "ALTER TABLE fuel_import_batches ADD COLUMN control_filename TEXT",
    "ALTER TABLE fuel_import_batches ADD COLUMN control_saved_path TEXT",
    "ALTER TABLE fuel_import_batches ADD COLUMN reconciliation_json TEXT",
    "ALTER TABLE fuel_import_batches ADD COLUMN matched_plates INTEGER DEFAULT 0",
  ].forEach((sql) => {
    try {
      db.prepare(sql).run();
    } catch (e) {}
  });
}

/** İş Bankası HGS PDF içe aktarma */
function migrateHgsImportSchema() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS hgs_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      plate_normalized TEXT,
      hgs_no TEXT,
      vehicle_class TEXT,
      period_start TEXT,
      period_end TEXT,
      balance INTEGER DEFAULT 0,
      balance_date TEXT,
      loading_count INTEGER DEFAULT 0,
      passage_count INTEGER DEFAULT 0,
      loading_total INTEGER DEFAULT 0,
      passage_total INTEGER DEFAULT 0,
      source_file_name TEXT,
      file_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS hgs_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      vehicle_id INTEGER,
      plate_normalized TEXT,
      transaction_type TEXT NOT NULL,
      highway TEXT,
      entry_point TEXT,
      entry_datetime TEXT,
      exit_point TEXT,
      exit_datetime TEXT,
      transaction_date TEXT,
      amount INTEGER DEFAULT 0,
      raw_line TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES hgs_reports(id)
    )
  `).run();

  try {
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_hgs_report_hash ON hgs_reports(file_hash) WHERE file_hash IS NOT NULL AND file_hash != ''`
    ).run();
  } catch (e) {}

  try {
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_hgs_tx_dedup ON hgs_transactions(
        report_id, transaction_type, transaction_date, amount, entry_point, exit_point
      )`
    ).run();
  } catch (e) {}

  [
    "ALTER TABLE transactions ADD COLUMN hgs_transaction_id INTEGER",
    "ALTER TABLE transactions ADD COLUMN expense_dedup_key TEXT",
    "ALTER TABLE hgs_transactions ADD COLUMN expense_id INTEGER",
  ].forEach((sql) => {
    try {
      db.prepare(sql).run();
    } catch (e) {}
  });

  try {
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_dedup ON transactions(expense_dedup_key) WHERE expense_dedup_key IS NOT NULL AND expense_dedup_key != ''`
    ).run();
  } catch (e) {}
}

/** Taşeron hakediş PDF içe aktarma */
function migrateHakedisImportSchema() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS hakedis_import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_label TEXT,
      company_name TEXT,
      period_date TEXT,
      source_file_name TEXT,
      file_hash TEXT,
      total_rows INTEGER DEFAULT 0,
      vehicle_rows INTEGER DEFAULT 0,
      extra_rows INTEGER DEFAULT 0,
      imported INTEGER DEFAULT 0,
      skipped_dup INTEGER DEFAULT 0,
      matched_vehicles INTEGER DEFAULT 0,
      unmatched_vehicles INTEGER DEFAULT 0,
      calculated_total INTEGER DEFAULT 0,
      pdf_hakedis_total INTEGER DEFAULT 0,
      pdf_kdv_total INTEGER DEFAULT 0,
      pdf_payable_total INTEGER DEFAULT 0,
      reconciliation_json TEXT,
      saved_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  [
    "ALTER TABLE transactions ADD COLUMN hakedis_import_id INTEGER",
    "ALTER TABLE transactions ADD COLUMN income_dedup_key TEXT",
  ].forEach((sql) => {
    try {
      db.prepare(sql).run();
    } catch (e) {}
  });

  try {
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_hakedis_batch_hash ON hakedis_import_batches(file_hash) WHERE file_hash IS NOT NULL AND file_hash != ''`
    ).run();
  } catch (e) {}

  try {
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_income_dedup ON transactions(income_dedup_key) WHERE income_dedup_key IS NOT NULL AND income_dedup_key != ''`
    ).run();
  } catch (e) {}
}

/** Gider kategorileri — kurumsal expense category system */
function migrateExpenseCategories() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT,
      description TEXT,
      is_system INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  try {
    db.prepare("ALTER TABLE transactions ADD COLUMN category_slug TEXT").run();
  } catch (e) {}

  seedExpenseCategories();
  backfillTransactionCategorySlugs();
}

function seedExpenseCategories() {
  const { EXPENSE_CATEGORY_SEED } = require("../lib/expenseCategoryMap");
  const insert = db.prepare(`
    INSERT INTO expense_categories (name, slug, icon, description, is_system, is_active, sort_order)
    SELECT ?, ?, ?, ?, 1, 1, ?
    WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE slug = ?)
  `);

  EXPENSE_CATEGORY_SEED.forEach(({ name, slug, icon, description, sort_order }) => {
    insert.run(name, slug, icon, description, sort_order, slug);
  });
}

function backfillTransactionCategorySlugs() {
  const { resolveSlugFromCategory } = require("../lib/expenseCategoryMap");
  const rows = db
    .prepare(
      `SELECT id, category, category_slug FROM transactions
       WHERE type = 'expense' AND (category_slug IS NULL OR trim(category_slug) = '')`
    )
    .all();

  const update = db.prepare(`UPDATE transactions SET category_slug = ? WHERE id = ?`);
  rows.forEach((r) => {
    update.run(resolveSlugFromCategory(r.category), r.id);
  });
}

/** Gelir kategorileri — income navigation architecture */
function migrateIncomeCategories() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS income_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      is_system INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  seedIncomeCategories();
  backfillIncomeCategorySlugs();
}

function seedIncomeCategories() {
  const { INCOME_CATEGORY_SEED } = require("../lib/incomeCategoryMap");
  const insert = db.prepare(`
    INSERT INTO income_categories (name, slug, description, is_system, is_active, sort_order)
    SELECT ?, ?, ?, 1, 1, ?
    WHERE NOT EXISTS (SELECT 1 FROM income_categories WHERE slug = ?)
  `);

  INCOME_CATEGORY_SEED.forEach(({ name, slug, description, sort_order }) => {
    insert.run(name, slug, description, sort_order, slug);
  });
}

function backfillIncomeCategorySlugs() {
  const { normalizeIncomeSlug } = require("../lib/incomeCategoryMap");
  const rows = db
    .prepare(
      `SELECT id, category, category_slug FROM transactions
       WHERE type = 'income' AND (category_slug IS NULL OR trim(category_slug) = '')`
    )
    .all();

  const update = db.prepare(`UPDATE transactions SET category_slug = ? WHERE id = ?`);
  rows.forEach((r) => {
    update.run(normalizeIncomeSlug(r.category), r.id);
  });
}

function migrateVehiclePlateNormalized() {
  try {
    db.prepare("ALTER TABLE vehicles ADD COLUMN plate_normalized TEXT").run();
  } catch (e) {}

  try {
    const { normalizePlate } = require("../utils/plate");
    const rows = db.prepare("SELECT id, plate, plate_normalized FROM vehicles").all();
    const update = db.prepare("UPDATE vehicles SET plate_normalized = ? WHERE id = ?");
    rows.forEach((r) => {
      const n = normalizePlate(r.plate);
      if (!n) return;
      if (r.plate_normalized !== n) update.run(n, r.id);
    });
  } catch (e) {
    console.warn("[db] plate_normalized backfill:", e.message);
  }

  try {
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_plate_normalized
       ON vehicles(plate_normalized)
       WHERE plate_normalized IS NOT NULL AND plate_normalized != ''`
    ).run();
  } catch (e) {
    console.warn("[db] plate_normalized unique index skipped (duplicate normalized plates may exist)");
  }
}

function migrateVehicleCurrentKm() {
  try {
    db.prepare("ALTER TABLE vehicles ADD COLUMN current_km INTEGER").run();
  } catch (e) {}
  db.prepare(
    `UPDATE vehicles SET current_km = COALESCE(NULLIF(current_km, 0), km, 0)
     WHERE current_km IS NULL OR current_km = 0`
  ).run();
  db.prepare(
    `UPDATE vehicles SET km = COALESCE(km, current_km, 0)
     WHERE km IS NULL OR km = 0`
  ).run();
}

function migrateAuditLogs() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      note TEXT
    )
  `).run();
}

function rebuildFuelRecordsNullable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fuel_records_import_tmp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      plate_text TEXT,
      fuel_type TEXT,
      liter REAL NOT NULL DEFAULT 0,
      price_per_liter REAL,
      total_amount INTEGER NOT NULL DEFAULT 0,
      km INTEGER,
      station TEXT,
      city TEXT,
      distributor TEXT,
      utts TEXT,
      transaction_no TEXT,
      invoice_no TEXT,
      invoice_date TEXT,
      fuel_date TEXT,
      source_file TEXT,
      import_batch_id INTEGER,
      dedup_key TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      liters REAL,
      total_cost INTEGER,
      date TEXT
    );
    INSERT INTO fuel_records_import_tmp (
      id, vehicle_id, plate_text, fuel_type, liter, price_per_liter, total_amount, km,
      station, city, distributor, utts, transaction_no, invoice_no, invoice_date,
      fuel_date, source_file, import_batch_id, dedup_key, note, created_at, liters, total_cost, date
    )
    SELECT
      id, vehicle_id, plate_text, fuel_type,
      COALESCE(liter, liters, 0),
      price_per_liter,
      COALESCE(total_amount, total_cost, 0),
      km, station, city, distributor, utts, transaction_no, invoice_no, invoice_date,
      fuel_date, source_file, import_batch_id, dedup_key, note, created_at, liters, total_cost, date
    FROM fuel_records;
    DROP TABLE fuel_records;
    ALTER TABLE fuel_records_import_tmp RENAME TO fuel_records;
  `);
}

/** Eski kolonlardan yeni kolonlara kopyala — kayıt silinmez */
function migrateLegacyColumns() {
  db.prepare(`
    UPDATE maintenance_records SET
      description = COALESCE(NULLIF(TRIM(description), ''), title, type),
      amount = CASE WHEN amount IS NULL OR amount = 0 THEN COALESCE(cost, 0) ELSE amount END,
      service_date = COALESCE(NULLIF(TRIM(service_date), ''), done_date),
      next_service_date = COALESCE(NULLIF(TRIM(next_service_date), ''), due_date)
  `).run();

  const typeMap = {
    yag: "yag_bakimi",
    periyodik: "periyodik",
  };
  Object.entries(typeMap).forEach(([oldKey, newKey]) => {
    db.prepare("UPDATE maintenance_records SET type = ? WHERE type = ?").run(newKey, oldKey);
  });

  db.prepare(`
    UPDATE fuel_records SET
      liter = COALESCE(liter, liters, 0),
      total_amount = CASE WHEN total_amount IS NULL OR total_amount = 0
        THEN COALESCE(total_cost, 0) ELSE total_amount END,
      fuel_date = COALESCE(NULLIF(TRIM(fuel_date), ''), substr(COALESCE(date, ''), 1, 10))
  `).run();
}

function seedDefaultAdmin() {
  const count = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  if (count > 0) return;
  db.prepare(
    `INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`
  ).run("admin", hashPassword("1234"));
}

function migrateVehicleDocuments() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS vehicle_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      title TEXT,
      expiry_date TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  try {
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle ON vehicle_documents(vehicle_id)`
    ).run();
  } catch (e) {}

  try {
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_vehicle_documents_expiry ON vehicle_documents(expiry_date)`
    ).run();
  } catch (e) {}
}

/** Compliance Center V1 — additive columns on vehicle_documents */
function migrateMaintenanceAlertsV1() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS maintenance_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      plate TEXT,
      maintenance_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unread',
      source_key TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      read_at DATETIME
    )
  `).run();

  try {
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_maintenance_alerts_status ON maintenance_alerts(status)`
    ).run();
  } catch (e) {}

  try {
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_maintenance_alerts_severity ON maintenance_alerts(severity)`
    ).run();
  } catch (e) {}
}

function migrateMaintenanceSchedulerV1() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS maintenance_schedule_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      maintenance_type TEXT NOT NULL,
      interval_km INTEGER,
      interval_days INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `).run();

  try {
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_maint_schedule_rules_vehicle_type
       ON maintenance_schedule_rules(vehicle_id, maintenance_type)`
    ).run();
  } catch (e) {}
}

function migrateMaintenanceCenterV1() {
  [
    "ALTER TABLE maintenance_records ADD COLUMN vendor TEXT",
    "ALTER TABLE maintenance_records ADD COLUMN updated_at DATETIME",
  ].forEach((sql) => {
    try {
      db.prepare(sql).run();
    } catch (e) {}
  });

  try {
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_date ON maintenance_records(vehicle_id, service_date)`
    ).run();
  } catch (e) {}
}

function migrateComplianceCenterV1() {
  [
    "ALTER TABLE vehicle_documents ADD COLUMN issue_date TEXT",
    "ALTER TABLE vehicle_documents ADD COLUMN policy_number TEXT",
    "ALTER TABLE vehicle_documents ADD COLUMN insurer TEXT",
    "ALTER TABLE vehicle_documents ADD COLUMN premium_amount INTEGER",
    "ALTER TABLE vehicle_documents ADD COLUMN file_path TEXT",
    "ALTER TABLE vehicle_documents ADD COLUMN file_name TEXT",
    "ALTER TABLE vehicle_documents ADD COLUMN station TEXT",
    "ALTER TABLE vehicle_documents ADD COLUMN result TEXT",
    "ALTER TABLE vehicle_documents ADD COLUMN reminder_days INTEGER",
  ].forEach((sql) => {
    try {
      db.prepare(sql).run();
    } catch (e) {}
  });

  try {
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_vehicle_documents_type ON vehicle_documents(vehicle_id, document_type)`
    ).run();
  } catch (e) {}
}

/** CC-5 — Internal compliance notifications (additive) */
function migrateComplianceNotificationsV1() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS compliance_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'compliance',
      severity TEXT NOT NULL,
      vehicle_id INTEGER,
      plate TEXT,
      document_type TEXT,
      document_id INTEGER,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unread',
      source_key TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME
    )
  `).run();

  try {
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_compliance_notifications_status ON compliance_notifications(status)`
    ).run();
  } catch (e) {}

  try {
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_compliance_notifications_severity ON compliance_notifications(severity)`
    ).run();
  } catch (e) {}
}

function migrateSubcontractors() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS subcontractors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      tax_info TEXT,
      note TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS subcontractor_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subcontractor_id INTEGER NOT NULL,
      customer_name TEXT,
      route_name TEXT,
      shift_type TEXT DEFAULT 'both',
      external_plate TEXT,
      related_vehicle_id INTEGER,
      monthly_agreed_amount INTEGER,
      note TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS subcontractor_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subcontractor_id INTEGER NOT NULL,
      assignment_id INTEGER,
      period TEXT,
      amount INTEGER NOT NULL DEFAULT 0,
      payment_date TEXT,
      invoice_no TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  [
    "CREATE INDEX IF NOT EXISTS idx_sub_assignments_sub ON subcontractor_assignments(subcontractor_id)",
    "CREATE INDEX IF NOT EXISTS idx_sub_payments_sub ON subcontractor_payments(subcontractor_id)",
    "CREATE INDEX IF NOT EXISTS idx_sub_payments_period ON subcontractor_payments(period)",
    "CREATE INDEX IF NOT EXISTS idx_sub_payments_assignment ON subcontractor_payments(assignment_id)",
  ].forEach((sql) => {
    try {
      db.prepare(sql).run();
    } catch (e) {}
  });
}

function migrateEmployees() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT,
      role TEXT,
      vehicle_id INTEGER,
      is_active INTEGER DEFAULT 1,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS employee_monthly_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      period TEXT NOT NULL,
      salary_amount INTEGER DEFAULT 0,
      travel_amount INTEGER DEFAULT 0,
      washing_amount INTEGER DEFAULT 0,
      bonus_amount INTEGER DEFAULT 0,
      advance_amount INTEGER DEFAULT 0,
      deduction_amount INTEGER DEFAULT 0,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  [
    "CREATE INDEX IF NOT EXISTS idx_employees_vehicle ON employees(vehicle_id)",
    "CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active)",
    "CREATE INDEX IF NOT EXISTS idx_employee_costs_employee ON employee_monthly_costs(employee_id)",
    "CREATE INDEX IF NOT EXISTS idx_employee_costs_period ON employee_monthly_costs(period)",
  ].forEach((sql) => {
    try {
      db.prepare(sql).run();
    } catch (e) {}
  });
}

function migratePayrollObligations() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS payroll_obligations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      obligation_type TEXT NOT NULL,
      period TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      person_count INTEGER,
      source_file_name TEXT,
      file_hash TEXT,
      status TEXT DEFAULT 'pending',
      paid_date TEXT,
      note TEXT,
      raw_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  try {
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_file_hash ON payroll_obligations(file_hash) WHERE file_hash IS NOT NULL AND file_hash != ''`
    ).run();
  } catch (e) {}

  try {
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_obligations(period)`
    ).run();
  } catch (e) {}
}

function migratePayrollAllocations() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS payroll_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      obligation_id INTEGER NOT NULL,
      employee_id INTEGER,
      vehicle_id INTEGER,
      period TEXT NOT NULL,
      allocation_type TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      basis TEXT DEFAULT 'equal_active_employee',
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  [
    "CREATE INDEX IF NOT EXISTS idx_payroll_alloc_obligation ON payroll_allocations(obligation_id)",
    "CREATE INDEX IF NOT EXISTS idx_payroll_alloc_vehicle ON payroll_allocations(vehicle_id)",
    "CREATE INDEX IF NOT EXISTS idx_payroll_alloc_period ON payroll_allocations(period)",
  ].forEach((sql) => {
    try {
      db.prepare(sql).run();
    } catch (e) {}
  });
}

function backfillMaintenanceFromTransactions() {
  const existing = db.prepare("SELECT COUNT(*) as c FROM maintenance_records").get().c;
  if (existing > 0) return;

  const map = {
    Muayene: "muayene",
    Sigorta: "sigorta",
    Lastik: "lastik",
    Bakım: "periyodik",
  };

  const rows = db
    .prepare(
      `SELECT vehicle_id, category, amount, note, date FROM transactions
       WHERE type = 'expense' AND category IN ('Muayene','Sigorta','Lastik','Bakım')`
    )
    .all();

  const insert = db.prepare(`
    INSERT INTO maintenance_records (
      vehicle_id, type, description, amount, service_date, next_service_date, note, status
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, 'done')
  `);

  rows.forEach((r) => {
    const d = String(r.date || "").slice(0, 10);
    insert.run(
      r.vehicle_id,
      map[r.category] || "diger",
      r.category,
      Number(r.amount || 0),
      d,
      r.note || ""
    );
  });
}

runMigrations();

module.exports = db;
module.exports.DB_PATH = DB_PATH;
module.exports.assertConnectionWritable = assertConnectionWritable;
