/// <reference lib="webworker" />
// DEMO database runs here, off the main thread: WASM compilation, migrations,
// seeding and every query no longer block rendering, input or scrolling.
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { worker } from '@electric-sql/pglite/worker'
import { BOOT_CHANNEL, initDemoDatabase } from './schema'

void worker({
  async init(options) {
    const boot = new BroadcastChannel(BOOT_CHANNEL)
    const report = (done: number, label: string) => boot.postMessage({ done, total: 5, label })
    report(1, 'Abrindo banco local')
    const pg = new PGlite({ dataDir: options.dataDir, extensions: { pgcrypto } })
    await pg.waitReady
    await initDemoDatabase(pg, report)
    boot.close()
    return pg
  },
})
