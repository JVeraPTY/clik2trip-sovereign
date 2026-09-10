import {
  completion,
  loadModel,
  MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0,
  unloadModel,
  VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M,
  type CompletionStats,
  type ModelProgressUpdate,
} from '@qvac/sdk';

import type { InferenceState, VisionAnalysis } from '@clik2trip/contracts';

import {
  extractionPrompt,
  parseVisionAnalysis,
  visionAnalysisJsonSchema,
} from './tourism';

export * from './catalog-rag';
export * from './demo-catalog';
export * from './regions';
export * from './tourism';

export const visionPsyModel = {
  displayName: 'VisionPsy-Nano-460M-Flash',
  modelConstant: 'VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M',
  modelFile: 'visionpsy-nano-460m-flash-q4_k_m-imat.gguf',
  modelSha256: '90b0abe16180f1fe5918bc5d89c3b6eeaf40520a50f906d6303a59a32b699fbc',
  modelBytes: 303143488,
  projectionConstant: 'MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0',
  projectionFile: 'mmproj-visionpsy-nano-460m-flash-q8.gguf',
  projectionSha256: 'bbb0691873a4e638f6928898b3c3be9a4730bd4ced301197726a4fcb549695d0',
  projectionBytes: 108782144,
  quantization: 'Q4_K_M',
  contextTokens: 1024,
} as const;

export interface VisionPsyResult {
  text: string;
  analysis: VisionAnalysis | null;
  stats: CompletionStats;
  totalMs: number;
}

export type StateListener = (state: InferenceState) => void;

export class VisionPsySession {
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
        modelSrc: VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M,
        modelConfig: {
          ctx_size: visionPsyModel.contextTokens,
          projectionModelSrc: MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0,
          image_no_upscale: 'on',
        },
        onProgress: (progress) => {
          if (progress.percentage >= 100) this.transition('LOADING');
          onProgress(progress);
        },
      });
      this.transition('READY');
    } catch (error) {
      this.transition('ERROR');
      throw error;
    }
  }

  async analyzeImage(
    imagePath: string,
    onToken: (token: string) => void = () => undefined,
  ): Promise<VisionPsyResult> {
    if (!this.modelId) throw new Error('QVAC_MODEL_NOT_READY');

    this.transition('RUNNING');
    const startedAt = Date.now();
    try {
      const run = completion({
        modelId: this.modelId,
        history: [
          {
            role: 'user',
            content: extractionPrompt,
            attachments: [{ path: imagePath }],
          },
        ],
        stream: true,
        generationParams: {
          predict: 192,
          temp: 0,
        },
        responseFormat: {
          type: 'json_schema',
          json_schema: {
            name: 'tourism_image_analysis',
            strict: true,
            schema: visionAnalysisJsonSchema,
          },
        },
      });

      let text = '';
      for await (const token of run.tokenStream) {
        text += token;
        onToken(token);
      }

      const stats = (await run.stats) ?? {};
      this.transition('READY');
      return {
        text,
        analysis: parseVisionAnalysis(text),
        stats,
        totalMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.transition('ERROR');
      throw error;
    }
  }

  async dispose(): Promise<void> {
    if (!this.modelId) return;
    const modelId = this.modelId;
    this.modelId = null;
    await unloadModel({ modelId, clearStorage: false });
    this.transition('NOT_READY');
  }
}
