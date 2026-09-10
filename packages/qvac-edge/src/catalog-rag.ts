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
  localTourDocuments,
  parseTourDocument,
} from './tourism';

export const catalogEmbeddingModel = {
  displayName: 'EmbeddingGemma 300M',
  modelConstant: 'EMBEDDINGGEMMA_300M_Q4_0',
  modelFile: 'embeddinggemma-300m-Q4_0.gguf',
  modelSha256: 'edc6015cb15694c27be7d1d33f1bc015db9a358ff51ed524628c027504907ba9',
  modelBytes: 277852192,
  quantization: 'Q4_0',
} as const;

export const catalogWorkspace = `clik2trip-${catalogSnapshotVersion}`;

type StateListener = (state: InferenceState) => void;

export class TourCatalogRagSession {
  private modelId: string | null = null;
  private state: InferenceState = 'NOT_READY';
  private readonly onState: StateListener;

  constructor(onState: StateListener = () => undefined) {
    this.onState = onState;
  }

  get currentState(): InferenceState {
    return this.state;
  }

  private transition(state: InferenceState) {
    this.state = state;
    this.onState(state);
  }

  async load(onProgress: (progress: ModelProgressUpdate) => void): Promise<void> {
    if (this.modelId) {
      this.transition('READY');
      return;
    }

    this.transition('DOWNLOADING');
    try {
      this.modelId = await loadModel({
        modelSrc: EMBEDDINGGEMMA_300M_Q4_0,
        onProgress: (progress) => {
          if (progress.percentage >= 100) this.transition('LOADING');
          onProgress(progress);
        },
      });

      const workspaces = await ragListWorkspaces();
      if (!workspaces.some((workspace) => workspace.name === catalogWorkspace)) {
        const result = await ragIngest({
          modelId: this.modelId,
          workspace: catalogWorkspace,
          documents: localTourDocuments,
          chunk: false,
        });
        const saved = result.processed.filter((item) => item.status === 'fulfilled').length;
        if (saved !== localTourDocuments.length) throw new Error('QVAC_RAG_INGEST_INCOMPLETE');
      }

      this.transition('READY');
    } catch (error) {
      const failedModelId = this.modelId;
      this.modelId = null;
      if (failedModelId) {
        await ragCloseWorkspace({ workspace: catalogWorkspace }).catch(() => undefined);
        await unloadModel({ modelId: failedModelId }).catch(() => undefined);
      }
      this.transition('ERROR');
      throw error;
    }
  }

  async search(query: string, topK = 3): Promise<LocalTourRecommendation[]> {
    if (!this.modelId) throw new Error('QVAC_RAG_NOT_READY');
    this.transition('RUNNING');
    try {
      const results = await ragSearch({
        modelId: this.modelId,
        workspace: catalogWorkspace,
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
    this.modelId = null;
    await ragCloseWorkspace({ workspace: catalogWorkspace }).catch(() => undefined);
    await unloadModel({ modelId });
    this.transition('NOT_READY');
  }
}
