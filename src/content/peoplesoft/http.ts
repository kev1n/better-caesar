import {
  getCurrentPeopleSoftTaskSignal,
  PeopleSoftTaskCancelledError
} from "./traffic";

type RequestOptions = {
  owner?: string;
};

export async function fetchPeopleSoft(
  actionUrl: string,
  params: URLSearchParams,
  options?: RequestOptions
): Promise<string> {
  const signal = getCurrentPeopleSoftTaskSignal();

  try {
    const res = await fetch(actionUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: params.toString(),
      signal
    });

    if (!res.ok) {
      throw new Error(`Search request failed (${res.status}).`);
    }

    return await res.text();
  } catch (error) {
    if (signal?.aborted) {
      const reason = signal.reason;
      if (reason instanceof PeopleSoftTaskCancelledError) {
        throw reason;
      }

      throw new PeopleSoftTaskCancelledError(
        reason instanceof Error ? reason.message : "PeopleSoft task canceled."
      );
    }

    throw error;
  }
}

export async function fetchPeopleSoftGet(url: string, options?: RequestOptions): Promise<string> {
  const signal = getCurrentPeopleSoftTaskSignal();

  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      signal
    });

    if (!res.ok) {
      throw new Error(`Context request failed (${res.status}).`);
    }

    return await res.text();
  } catch (error) {
    if (signal?.aborted) {
      const reason = signal.reason;
      if (reason instanceof PeopleSoftTaskCancelledError) {
        throw reason;
      }

      throw new PeopleSoftTaskCancelledError(
        reason instanceof Error ? reason.message : "PeopleSoft task canceled."
      );
    }

    throw error;
  }
}
