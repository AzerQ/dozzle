import * as duckdb from "@duckdb/duckdb-wasm";

const duckdbBaseUrl = `${import.meta.env.BASE_URL}duckdb/`;

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: `${duckdbBaseUrl}duckdb-mvp.wasm`,
    mainWorker: `${duckdbBaseUrl}duckdb-browser-mvp.worker.js`,
  },
  eh: {
    mainModule: `${duckdbBaseUrl}duckdb-eh.wasm`,
    mainWorker: `${duckdbBaseUrl}duckdb-browser-eh.worker.js`,
  },
};

export async function createDuckDb() {
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

  if (!bundle.mainWorker) {
    throw new Error("DuckDB worker file is not available");
  }

  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);

  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  return { db, worker };
}

export async function useDuckDB() {
  let cleanup: (() => void) | undefined;
  onUnmounted(() => cleanup?.());
  const { db, worker } = await createDuckDb();
  const conn = await db.connect();

  await initOfflinePluginsRepository(conn);
  cleanup = async () => {
    console.log("Cleaning up DuckDB");
    await conn.close();
    await db.terminate();
    worker.terminate();
  };

  return { db, conn };
}

async function initOfflinePluginsRepository(conn: duckdb.AsyncDuckDBConnection) {
  const extensionRepository = `${window.location.origin}${import.meta.env.BASE_URL}duckdb-extensions/duckdb-wasm`;

  await conn.query(`
    SET custom_extension_repository = '${extensionRepository}';
  `);

  await conn.query(`INSTALL json;`);
}
