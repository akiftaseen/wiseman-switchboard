export async function api(path, method = 'GET', body) {
  let response;
  try {
    response = await fetch('/api/' + path, {
      method,
      ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    });
  } catch {
    throw new Error('Could not reach the local server. Check the connection and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    const error = new Error(data?.error || 'The local server is unavailable. Please try again.');
    error.fields = data?.fields;
    throw error;
  }
  return data;
}
