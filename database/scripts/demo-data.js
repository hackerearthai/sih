'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('../src/client');
const { migrate } = require('./migrate');

const samples = [
  ['FIR_DEMO_001.txt', 'Central Investigations', 'DEMO-2026-001', 'investigator1', 'clean'],
  ['Witness_Statement_DEMO.txt', 'Central Investigations', 'DEMO-2026-001', 'clerk1', 'review_recommended'],
  ['Evidence_Inventory_DEMO.txt', 'Digital Evidence Unit', 'DEMO-2026-002', 'investigator2', 'clean'],
  ['Forensic_Report_DEMO.txt', 'Regional Forensics', 'DEMO-2026-003', 'investigator1', 'clean'],
  ['Chain_of_Custody_DEMO.txt', 'Digital Evidence Unit', 'DEMO-2026-002', 'clerk1', 'review_recommended'],
  ['Altered_Record_DEMO.txt', 'Central Investigations', 'DEMO-2026-004', 'admin1', 'clean'],
];

async function seedDemoData() {
  await migrate();
  const uploadDir = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
  const directory = path.join(uploadDir, 'demo');
  await fs.mkdir(directory, { recursive: true });
  let added = 0;
  await db.transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [26191]);
    for (let index = 0; index < samples.length; index++) {
      const [filename, workspace, caseReference, username, risk] = samples[index];
      const id = `d0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      if ((await client.query('SELECT 1 FROM public.documents WHERE doc_id = $1', [id])).rowCount) continue;
      const user = (await client.query('SELECT user_id FROM public.users WHERE username = $1', [username])).rows[0];
      if (!user) throw new Error('Seed demo users first: npm run db:seed');
      const content = `SENTINEL RECORDS - DEMO DATA ONLY\n${filename}\nCase: ${caseReference}\nWorkspace: ${workspace}\n\nThis is a fictional sample for testing search, downloads, assignments and verification.\nIt does not describe a real person, case, or investigation.\nNo blockchain registration exists for this demo record.\n`;
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const filepath = path.join(directory, `${id}.txt`);
      // Never overwrite an existing fixture file or an edited record on reruns.
      await fs.writeFile(filepath, content + (index === 5 ? '\nINTENTIONAL DEMO CHANGE: fingerprint mismatch.\n' : ''), { flag: 'wx' }).catch((error) => { if (error.code !== 'EEXIST') throw error; });
      const created = new Date(Date.now() - (index + 1) * 86400000).toISOString();
      await client.query(`INSERT INTO public.documents
        (doc_id, filename, filepath, doc_hash, uploader_id, ai_risk_flag, status, is_demo, workspace, case_reference, assigned_to, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,$5,$10)`,
      [id, filename, filepath, hash, user.user_id, risk, index === 5 ? 'tampered' : 'verified', workspace, caseReference, created]);
      await client.query(`INSERT INTO public.document_versions (doc_id, version_number, filepath, doc_hash, reason, updated_by, created_at)
        VALUES ($1,1,$2,$3,'Initial fictional demo record',$4,$5)`, [id, filepath, hash, user.user_id, created]);
      await client.query(`INSERT INTO public.access_log_cache (doc_id,user_id,action,detail,created_at)
        VALUES ($1,$2,'upload','Fictional demo record added; no blockchain registration',$3)`, [id, user.user_id, created]);
      added++;
    }
  });
  console.log(`[demo] Added ${added} demo documents. Existing records were preserved.`);
  return added;
}
module.exports = { seedDemoData };
if (require.main === module) seedDemoData().then(() => db.close()).catch(async (error) => {
  console.error('[demo]', error.message); await db.close(); process.exitCode = 1;
});
