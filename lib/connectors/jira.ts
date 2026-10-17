import 'server-only';
import { nanoid } from 'nanoid';
import { getDb, schema } from '@/lib/db/client';
import { logAudit } from '@/lib/audit';

// PRD §12 — Jira Nacora filter. Uses Atlassian REST API v3 (JQL search).
// Auth: email + API token in .env. Read-only; we just fetch issues.
// The default JQL matches the seed link in the PRD.

const DEFAULT_JQL = 'cf[10101] = "Nacora"';

export async function pullJira(jql: string = DEFAULT_JQL, limit = 100) {
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  if (!email || !token) throw new Error('ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN not set in .env');

  const host = process.env.ATLASSIAN_HOST ?? 'tigerlab.atlassian.net';
  const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');

  const url = new URL(`https://${host}/rest/api/3/search`);
  url.searchParams.set('jql', jql);
  url.searchParams.set('maxResults', String(limit));
  url.searchParams.set('fields', 'summary,status,assignee,updated,priority,issuetype,description');

  const res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Jira ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;

  const db = getDb();
  let created = 0;
  for (const issue of data.issues ?? []) {
    const label = `${issue.key} — ${issue.fields.summary}`;
    const extracted = [
      `Status: ${issue.fields.status?.name}`,
      `Assignee: ${issue.fields.assignee?.displayName ?? 'unassigned'}`,
      `Updated: ${issue.fields.updated}`,
      `Priority: ${issue.fields.priority?.name}`,
      '',
      typeof issue.fields.description === 'string' ? issue.fields.description : JSON.stringify(issue.fields.description ?? {}),
    ].join('\n');
    await db.insert(schema.sources).values({
      id: nanoid(),
      type: 'jira',
      label,
      url: `https://${host}/browse/${issue.key}`,
      extractedText: extracted,
      metadata: { key: issue.key, status: issue.fields.status?.name },
    });
    created += 1;
  }
  await logAudit({
    type: 'connector.jira_pull',
    actor: 'sync',
    payload: { jql, count: created },
  });
  return { created };
}
