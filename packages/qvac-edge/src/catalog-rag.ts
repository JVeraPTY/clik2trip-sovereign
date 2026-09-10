import {
  EMBEDDINGGEMMA_300M_Q4_0,
  loadModel,
  ragCloseWorkspace,
  ragIngest,
  ragListWorkspaces,
  ragSearch,
  unloadModel,
  type ModelProgressUpdate,
} from '@qvac/sdk';

import type { InferenceState, LocalTourRecommendation } from '@clik2trip/contracts';

import {
  catalogSnapshotVersion,
  documentsForRegions,
  parseTourDocument,
} from './tourism';
import { fallbackRegionId } from './regions';

export const catalogEmbeddingModel = {
  displayName: 'EmbeddingGemma 300M',
  modelConstant: 'EMBEDDINGGEMMA_300M_Q4_0',
  modelFile: 'embeddinggemma-300m-Q4_0.gguf',
  modelSha256: 'edc6015cb15694c27be7d1d33f1bc015db9a358ff51ed524628c027504907ba9',
  modelBytes: 277852192,
  quantization: 'Q4_0',
} as const;

/**
 * One workspace per snapshot version and region. The region is part of the name
 * so a traveler who moves gets a fresh corpus for where they are, and the
 * previous one stays on disk rather than being rebuilt on every trip back.
 */
export function catalogWorkspaceFor(regionIds: readonly string[]): string {
  const scope = [...regionIds].sort().join('_') || fallbackRegionId;
  return `clik2trip-${catalogSnapshotVersion}-${scope}`;
}

type StateListener = (state: InferenceState) => void;

export class TourCatalogRagSession {
  private modelId: string | null = null;
  private workspace: string | null = null;
  private state: InferenceState = 'NOT_READY';
  private readonly onState: StateListener;

  constructor(onState: StateListener = () => undefined) {
    this.onState = onState;
  }

  /** The workspace currently loaded, for evidence and for the interface. */
  get currentWorkspace(): string | null {
    return this.workspace;
  }

  get currentState(): InferenceState {
    return this.state;
  }

  private transition(state: InferenceState) {
    this.state = state;
    this.onState(state);
  }

  /**
   * Loads the embedding model and ingests the snapshot for `regionIds`. Called
   * once the device's region is known, so the corpus matches where the traveler
   * is standing rather than being the same everywhere.
   */
  async load(
    onProgress: (progress: ModelProgressUpdate) => void,
    requestedRegionIds: readonly string[] = [fallbackRegionId],
  ): Promise<void> {
    // An empty list would ingest only the bookable four; fall back instead, so
    // a device that somehow reaches here without a region still gets a corpus.
    const regionIds = requestedRegionIds.length > 0 ? requestedRegionIds : [fallbackRegionId];
    const workspace = catalogWorkspaceFor(regionIds);
    if (this.modelId && this.workspace === workspace) {
      this.transition('READY');
      return;
    }
    // A region change keeps the loaded model and swaps the corpus underneath it.
    if (this.modelId && this.workspace !== workspace) {
      await ragCloseWorkspace({ workspace: this.workspace ?? '' }).catch(() => undefined);
      this.workspace = null;
    }

    const documents = documentsForRegions(regionIds);
    this.transition('DOWNLOADING');
    try {
      this.modelId ??= await loadModel({
        modelSrc: EMBEDDINGGEMMA_300M_Q4_0,
        onProgress: (progress) => {
          if (progress.percentage >= 100) this.transition('LOADING');
          onProgress(progress);
        },
      });

      const workspaces = await ragListWorkspaces();
      if (!workspaces.some((existing) => existing.name === workspace)) {
        const result = await ragIngest({
          modelId: this.modelId,
          workspace,
          documents,
          chunk: false,
        });
        const saved = result.processed.filter((item) => item.status === 'fulfilled').length;
        if (saved !== documents.length) throw new Error('QVAC_RAG_INGEST_INCOMPLETE');
      }

      this.workspace = workspace;
      this.transition('READY');
    } catch (error) {
      const failedModelId = this.modelId;
      this.modelId = null;
      this.workspace = null;
      if (failedModelId) {
        await ragCloseWorkspace({ workspace }).catch(() => undefined);
        await unloadModel({ modelId: failedModelId }).catch(() => undefined);
      }
      this.transition('ERROR');
      throw error;
    }
  }

  async search(query: string, topK = 3): Promise<LocalTourRecommendation[]> {
    if (!this.modelId || !this.workspace) throw new Error('QVAC_RAG_NOT_READY');
    this.transition('RUNNING');
    try {
      const results = await ragSearch({
        modelId: this.modelId,
        workspace: this.workspace,
        query,
        topK,
      });
      this.transition('READY');

      return results.flatMap((result) => {
        try {
          return [{ tour: parseTourDocument(result.content), score: result.score }];
        } catch {
          return [];
        }
      });
    } catch (error) {
      this.transition('ERROR');
      throw error;
    }
  }

  async dispose(): Promise<void> {
    if (!this.modelId) return;
    const modelId = this.modelId;
    const workspace = this.workspace;
    this.modelId = null;
    this.workspace = null;
    if (workspace) await ragCloseWorkspace({ workspace }).catch(() => undefined);
    await unloadModel({ modelId });
    this.transition('NOT_READY');
  }
}
