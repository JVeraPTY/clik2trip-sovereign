import { createPerformanceRecord } from '@clik2trip/performance-log';
import {
  buildTourismQuery,
  type TourCatalogRagSession,
  type VisionPsySession,
  visionPsyPrompt,
} from '@clik2trip/qvac-edge';
import { Asset } from 'expo-asset';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Network from 'expo-network';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import casesManifest from '../../../../evaluation/quality/cases.json';

import { qualityImageAssets } from '../evaluation/quality-assets';
import { remainedOffline, type ConnectivitySnapshot } from '../lib/network-evidence';
import { brand, radius, space, text } from '../theme/brand';

interface QualityEvaluationPanelProps {
  catalogRag: TourCatalogRagSession;
  ready: boolean;
  vision: VisionPsySession;
}

type QualityCase = (typeof casesManifest.cases)[number];

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function evidenceMatches(item: QualityCase, evidence: string[]): boolean {
  const observed = normalize(evidence.join(' '));
  return item.expected.explanationEvidence.some((candidate) =>
    observed.includes(normalize(candidate)),
  );
}

function localAssetPath(uri: string): string {
  return uri.startsWith('file://') ? decodeURIComponent(uri.slice(7)) : uri;
}

async function materializeAsset(module: number): Promise<string> {
  const asset = Asset.fromModule(module);

  // A standalone Android build resolves bundled images to a drawable resource
  // name and marks that value as `localUri` for React Native Image compatibility.
  // QVAC attachments need a real filesystem path. Re-wrapping the resource URI
  // makes expo-asset copy its bytes from the APK into the private cache.
  if (Platform.OS === 'android' && asset.localUri && !asset.localUri.includes(':')) {
    const cached = Asset.fromURI(asset.uri);
    await cached.downloadAsync();
    if (!cached.localUri?.startsWith('file://')) {
      throw new Error('QUALITY_ASSET_MATERIALIZATION_FAILED');
    }
    return localAssetPath(cached.localUri);
  }

  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri.startsWith('file://')) throw new Error('QUALITY_ASSET_MATERIALIZATION_FAILED');
  return localAssetPath(uri);
}

export function QualityEvaluationPanel({ catalogRag, ready, vision }: QualityEvaluationPanelProps) {
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [resultFileUri, setResultFileUri] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const cancelled = useRef(false);

  async function runEvaluation() {
    if (!ready || running) return;
    setRunning(true);
    setCompleted(0);
    setErrorCode(null);
    setResultFileUri(null);
    cancelled.current = false;
    const records: Record<string, unknown>[] = [];
    const destination = `${FileSystem.documentDirectory}quality-results.jsonl`;
    await activateKeepAwakeAsync('quality-evaluation');
    try {
      for (const item of casesManifest.cases) {
        if (cancelled.current) break;
        const module = qualityImageAssets[item.id];
        if (module === undefined) throw new Error(`QUALITY_ASSET_MISSING_${item.id}`);
        const imagePath = await materializeAsset(module);

        let initialNetworkState: ConnectivitySnapshot = {};
        let connectionObservedDuringRun = false;
        let subscription: { remove: () => void } | undefined;
        let shouldStopAfterPersisting = false;
        const startedAt = Date.now();
        try {
          initialNetworkState = await Network.getNetworkStateAsync();
          subscription = Network.addNetworkStateListener((networkState) => {
            if (networkState.isConnected === true || networkState.isInternetReachable === true) {
              connectionObservedDuringRun = true;
            }
          });
          const result = await vision.analyzeImage(imagePath);
          const recommendations = await catalogRag.search(
            buildTourismQuery(result.analysis, result.text),
          );
          const finalNetworkState = await Network.getNetworkStateAsync().catch(() => ({}));
          const performance = createPerformanceRecord({
            recordedAt: new Date().toISOString(),
            deviceModel: Device.modelName ?? 'unknown-android-device',
            androidVersion: String(Platform.Version),
            loadMs: 0,
            promptHash: visionPsyPrompt.sha256,
            promptCategory: visionPsyPrompt.id,
            promptTokens: result.stats.promptTokens,
            generatedTokens: result.stats.generatedTokens,
            emittedTokens: result.stats.emittedTokens,
            timeToFirstToken: result.stats.timeToFirstToken,
            tokensPerSecond: result.stats.tokensPerSecond,
            totalMs: result.totalMs,
            backendDevice: result.stats.backendDevice,
            success: result.analysis !== null,
            errorCode: result.analysis === null ? 'QVAC_SCHEMA_OUTPUT_INVALID' : null,
            offline: remainedOffline(
              initialNetworkState,
              finalNetworkState,
              connectionObservedDuringRun,
            ),
          });
          records.push({
            ...performance,
            caseId: item.id,
            imageSha256: item.imageSha256,
            actual: {
              category: result.analysis?.category ?? '',
              destination: result.analysis?.destination ?? null,
              durationMinutes: result.analysis?.durationMinutes ?? null,
              restrictions: result.analysis?.restrictions ?? [],
              confidence: result.analysis?.confidence ?? 0,
            },
            recommendationIds: recommendations.map(({ tour }) => tour.tourRefId),
            explanationGrounded:
              result.analysis !== null && evidenceMatches(item, result.analysis.evidence),
            explanationReview: 'automated-visible-evidence-overlap-v1',
          });
        } catch (cause) {
          const code = cause instanceof Error ? cause.message : 'QUALITY_EVALUATION_FAILED';
          const performance = createPerformanceRecord({
            recordedAt: new Date().toISOString(),
            deviceModel: Device.modelName ?? 'unknown-android-device',
            androidVersion: String(Platform.Version),
            loadMs: 0,
            promptHash: visionPsyPrompt.sha256,
            promptCategory: visionPsyPrompt.id,
            totalMs: Date.now() - startedAt,
            success: false,
            errorCode: code,
            offline: false,
          });
          records.push({
            ...performance,
            caseId: item.id,
            imageSha256: item.imageSha256,
            actual: {
              category: '',
              destination: null,
              durationMinutes: null,
              restrictions: [],
              confidence: 0,
            },
            recommendationIds: [],
            explanationGrounded: false,
            explanationReview: 'not-available-after-error',
          });
          setErrorCode(code);
          shouldStopAfterPersisting = true;
        } finally {
          subscription?.remove();
        }

        await FileSystem.writeAsStringAsync(
          destination,
          `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
        );
        setCompleted(records.length);
        if (shouldStopAfterPersisting) break;
      }
      if (records.length > 0) setResultFileUri(destination);
    } finally {
      deactivateKeepAwake('quality-evaluation');
      setRunning(false);
    }
  }

  async function shareResults() {
    if (!resultFileUri) return;
    if (!(await Sharing.isAvailableAsync())) {
      setErrorCode('QUALITY_SHARE_UNAVAILABLE');
      return;
    }
    await Sharing.shareAsync(resultFileUri, {
      dialogTitle: 'Exportar evaluación local',
      mimeType: 'application/x-ndjson',
      UTI: 'public.json',
    });
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Laboratorio de evaluación</Text>
      <Text style={styles.copy}>
        Ejecuta 20 imágenes con licencia abierta directamente en VisionPsy y el RAG local. Puede
        tardar unos 40 minutos. No exporta las imágenes ni el prompt.
      </Text>
      <Text style={styles.progress}>
        {completed}/{casesManifest.cases.length} casos
      </Text>
      {running ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            cancelled.current = true;
          }}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Detener después del caso actual</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={!ready}
          onPress={() => void runEvaluation()}
          style={[styles.button, !ready && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{ready ? 'Ejecutar los 20 casos' : 'QVAC y RAG no están listos'}</Text>
        </Pressable>
      )}
      {resultFileUri ? (
        <Pressable accessibilityRole="button" onPress={() => void shareResults()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Exportar JSONL</Text>
        </Pressable>
      ) : null}
      {errorCode ? <Text selectable style={styles.error}>{errorCode}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: brand.bg,
    borderColor: brand.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space[3],
    padding: space[5],
  },
  title: { color: brand.fg, fontSize: text.lg, fontWeight: '700' },
  copy: { color: brand.fgMuted, fontSize: text.sm, lineHeight: 20 },
  progress: { color: brand.primaryText, fontSize: text.base, fontWeight: '800' },
  button: {
    alignItems: 'center',
    backgroundColor: brand.primary,
    borderRadius: radius.md,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  buttonDisabled: { backgroundColor: brand.disabledBg },
  buttonText: { color: brand.onPrimary, fontSize: text.sm, fontWeight: '700' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: brand.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  secondaryButtonText: { color: brand.primaryText, fontSize: text.sm, fontWeight: '700' },
  error: { color: brand.danger, fontSize: text.sm },
});
