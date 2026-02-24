export interface Augmentation {
  readonly id: string;
  run(doc?: Document): void;
}

export abstract class TemplateAugmentation<TTarget, TData> implements Augmentation {
  readonly id: string;

  private readonly cache = new Map<string, Promise<TData>>();
  private queueTail: Promise<void> = Promise.resolve();

  protected constructor(id: string) {
    this.id = id;
  }

  run(doc: Document = document): void {
    if (!this.appliesToPage(doc)) return;

    this.beforeRun(doc);
    const targets = this.collectTargets(doc);

    for (const target of targets) {
      const key = this.targetKey(target);
      if (!this.shouldProcessTarget(target, key)) continue;

      this.markLoading(target, key);
      const dataPromise = this.getOrCreateDataPromise(key, target, doc);

      void dataPromise
        .then((data) => {
          this.renderSuccess(target, data, key);
          this.markLoaded(target, key);
        })
        .catch((error: unknown) => {
          this.renderError(target, this.toError(error), key);
        });
    }
  }

  protected beforeRun(_doc: Document): void {
    // Optional hook for each run cycle.
  }

  protected abstract appliesToPage(doc: Document): boolean;
  protected abstract collectTargets(doc: Document): TTarget[];
  protected abstract targetKey(target: TTarget): string;
  protected abstract shouldProcessTarget(target: TTarget, key: string): boolean;
  protected abstract markLoading(target: TTarget, key: string): void;
  protected abstract fetchData(target: TTarget, key: string, doc: Document): Promise<TData>;
  protected abstract renderSuccess(target: TTarget, data: TData, key: string): void;
  protected abstract renderError(target: TTarget, error: Error, key: string): void;

  protected markLoaded(_target: TTarget, _key: string): void {
    // Optional hook after successful render.
  }

  private getOrCreateDataPromise(key: string, target: TTarget, doc: Document): Promise<TData> {
    const cached = this.cache.get(key);
    if (cached) return cached;

    const job = this.enqueue(() => this.fetchData(target, key, doc));
    this.cache.set(key, job);
    return job;
  }

  private enqueue(task: () => Promise<TData>): Promise<TData> {
    const job = this.queueTail.then(task);

    this.queueTail = job.then(
      () => undefined,
      () => undefined
    );

    return job;
  }

  private toError(error: unknown): Error {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }
}
