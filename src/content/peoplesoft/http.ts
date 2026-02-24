export async function fetchPeopleSoft(actionUrl: string, params: URLSearchParams): Promise<string> {
  const res = await fetch(actionUrl, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    },
    body: params.toString()
  });

  if (!res.ok) {
    throw new Error(`Search request failed (${res.status}).`);
  }

  return res.text();
}
