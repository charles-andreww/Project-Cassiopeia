export async function getEphemeral(): Promise<string> {
  const r = await fetch('/api/gemini/ephemeral', {
    method: 'POST',
    headers: { 'cache-control': 'no-store' },
  });
  if (!r.ok) throw new Error('ephemeral fetch failed');
  const data = await r.json();
  return data.token as string;
}
