import { createPerformanceRecord } from '@clik2trip/performance-log';
import {
  buildTourismQuery,
  catalogEmbeddingModel,
  findLocalTour,
  TourCatalogRagSession,
  toursForRegions,
  VisionPsySession,
  visionPsyModel,
  visionPsyPrompt,
} from '@clik2trip/qvac-edge';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  InferenceState,
  LocalTourRecommendation,
  PerformanceRecord,
  VisionAnalysis,
} from '@clik2trip/contracts';
import type { CompletionStats } from '@qvac/sdk';

import { analysisPhaseLabel, formatElapsed } from '../lib/inference-phase';
import {
  nextOnboardingStep,
  onboardingLabels,
  type OnboardingStep,
  type OnboardingStepId,
  type OnboardingStepStatus,
} from '../lib/onboarding';
import { remainedOffline, type ConnectivitySnapshot } from '../lib/network-evidence';
import { catalogCard, recommendationCard } from '../lib/experience-card';
import { demoBookingSource, gatewayBookingSource } from '../lib/booking-source';
import { regionNotice } from '../lib/device-region';
import { useDemoWallet } from '../lib/use-demo-wallet';
import { useDeviceRegion } from '../lib/use-device-region';
import { useExperienceCatalog } from '../lib/use-experience-catalog';
import { useGatewayClient } from '../lib/use-gateway-client';
import { sepolia } from '@clik2trip/wdk-wallet/sepolia';
import { brand, radius, space, text } from '../theme/brand';
import { AppHeader } from './AppHeader';
import { ErrorNotice } from './ErrorNotice';
import { ExperienceList } from './ExperienceCatalog';
import { ExperienceDetail } from './ExperienceDetail';
import { OnboardingFooter } from './OnboardingFooter';
import { QualityEvaluationPanel } from './QualityEvaluationPanel';

type PhotoPrivacyState = 'NO_PHOTO' | 'STORED_TEMPORARILY' | 'DELETED' | 'DELETE_FAILED';

function ActionButton({
  disabled = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, disabled && styles.buttonDisabled, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

export function CompatibilityGate() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [photoPrivacyState, setPhotoPrivacyState] = useState<PhotoPrivacyState>('NO_PHOTO');
  const [inferenceState, setInferenceState] = useState<InferenceState>('NOT_READY');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [ragState, setRagState] = useState<InferenceState>('NOT_READY');
  const [ragDownloadPercent, setRagDownloadPercent] = useState(0);
  const [loadMs, setLoadMs] = useState(0);
  const [output, setOutput] = useState('');
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<LocalTourRecommendation[]>([]);
  const [stats, setStats] = useState<CompletionStats | null>(null);
  const [record, setRecord] = useState<PerformanceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qvac] = useState(() => new VisionPsySession(setInferenceState));
  const [catalogRag] = useState(() => new TourCatalogRagSession(setRagState));
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [analysisElapsedMs, setAnalysisElapsedMs] = useState(0);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [selectedTourRefId, setSelectedTourRefId] = useState<string | null>(null);
  const gatewayClient = useGatewayClient();
  const {
    experiences: catalogExperiences,
    loading: catalogLoading,
    error: catalogError,
  } = useExperienceCatalog(gatewayClient);
  const {
    status: regionStatus,
    resolution: region,
    resolve: resolveDeviceRegion,
  } = useDeviceRegion();
  const { status: walletStatus, open: openDemoWallet } = useDemoWallet();
  const [walletOpening, setWalletOpening] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const startedSteps = useRef<Set<OnboardingStepId>>(new Set());

  const selectedSource = useMemo(() => {
    if (selectedTourRefId === null) return null;
    const local = findLocalTour(selectedTourRefId);
    if (local?.source === 'demo-seed') return demoBookingSource(local);
    const slug =
      catalogExperiences.find((entry) => entry.tourRefId === selectedTourRefId)?.slug ??
      local?.slug ??
      null;
    return slug === null ? null : gatewayBookingSource(gatewayClient, slug);
  }, [catalogExperiences, gatewayClient, selectedTourRefId]);

  function modelStepStatus(state: InferenceState): OnboardingStepStatus {
    if (state === 'READY') return 'DONE';
    if (state === 'ERROR' || state === 'CANCELLED') return 'FAILED';
    if (state === 'NOT_READY') return 'PENDING';
    return 'RUNNING';
  }

  // Only this app's own attempt counts as RUNNING. WDK reports INITIALIZING
  // while it boots, and treating that as a running step made the third step
  // claim to be in progress before the first had started, which stopped the
  // sequence dead: it advances one step at a time and waits while any runs.
  const walletStepStatus: OnboardingStepStatus =
    walletStatus === 'READY'
      ? 'DONE'
      : walletStatus === 'ERROR'
        ? 'FAILED'
        : walletOpening
          ? 'RUNNING'
          : 'PENDING';

  // Region comes first: the catalog step needs to know which snapshot to
  // ingest, and resolving it costs a permission prompt, not a download.
  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'region',
      label: onboardingLabels.region,
      technical: region ? `${region.region.name} · ${region.regionIds.length} zonas` : 'ubicación aproximada',
      status: regionStatus === 'READY' ? 'DONE' : regionStatus === 'RESOLVING' ? 'RUNNING' : 'PENDING',
    },
    {
      id: 'vision',
      label: onboardingLabels.vision,
      technical: `${visionPsyModel.displayName} · ${visionPsyModel.quantization}`,
      status: modelStepStatus(inferenceState),
      percent: downloadPercent,
    },
    {
      id: 'catalog',
      label: onboardingLabels.catalog,
      technical: `${catalogEmbeddingModel.displayName} · ${catalogEmbeddingModel.quantization}`,
      status: modelStepStatus(ragState),
      percent: ragDownloadPercent,
    },
    {
      id: 'wallet',
      label: onboardingLabels.wallet,
      technical: `WDK · ${sepolia.displayName} · chainId ${sepolia.chainIdString}`,
      status: walletStepStatus,
    },
  ];

  // Runs the four preparations in order, once per app load. The ref guards
  // against a second start while an async step has not yet moved its state.
  useEffect(() => {
    if (onboardingDismissed) return;
    const next = nextOnboardingStep(onboardingSteps);
    if (next === null || startedSteps.current.has(next)) return;
    // The wallet can only be opened once WDK has finished booting; leave the
    // step unstarted so this runs again when it is ready.
    if (next === 'wallet' && walletStatus !== 'LOCKED' && walletStatus !== 'NO_WALLET') {
      return;
    }
    startedSteps.current.add(next);
    if (next === 'region') {
      void resolveDeviceRegion();
      return;
    }
    if (next === 'vision') {
      void loadVisionPsy();
      return;
    }
    if (next === 'catalog') {
      void loadLocalCatalog(region?.regionIds ?? []);
      return;
    }
    setWalletOpening(true);
    void openDemoWallet()
      .catch((cause: unknown) => {
        setOnboardingError(cause instanceof Error ? cause.message : 'WDK_WALLET_FAILED');
      })
      .finally(() => setWalletOpening(false));
  });

  function retryOnboarding() {
    startedSteps.current.clear();
    setOnboardingError(null);
  }

  // The local run takes around two minutes, most of it before the first token.
  // This clock is what keeps that from reading as a frozen screen.
  useEffect(() => {
    if (analysisStartedAt === null) return;
    const timer = setInterval(() => {
      setAnalysisElapsedMs(Date.now() - analysisStartedAt);
    }, 1000);
    return () => clearInterval(timer);
  }, [analysisStartedAt]);

  useEffect(() => {
    return () => {
      void qvac.dispose();
      void catalogRag.dispose();
    };
  }, [catalogRag, qvac]);

  async function prepareCamera() {
    setError(null);
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('CAMERA_PERMISSION_DENIED');
        return;
      }
    }
    setCameraOpen(true);
  }

  async function captureImage() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7, skipProcessing: true });
    if (!photo?.uri) {
      setError('CAMERA_CAPTURE_FAILED');
      return;
    }
    const localPath = photo.uri.startsWith('file://') ? decodeURIComponent(photo.uri.slice(7)) : photo.uri;
    setImagePath(localPath);
    setPhotoPrivacyState('STORED_TEMPORARILY');
    setCameraOpen(false);
    // The capture is the whole gesture: closing the camera starts the local
    // analysis without a second tap. `localPath` is passed explicitly because
    // the state set above has not settled yet.
    void runAnalysis(localPath);
  }

  async function loadVisionPsy() {
    setError(null);
    const startedAt = Date.now();
    try {
      await qvac.load((progress) => setDownloadPercent(Math.round(progress.percentage)));
      setLoadMs(Date.now() - startedAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'QVAC_LOAD_FAILED');
    }
  }

  async function loadLocalCatalog(regionIds: readonly string[]) {
    setError(null);
    try {
      await catalogRag.load((progress) => {
        setRagDownloadPercent(Math.round(progress.percentage));
      }, regionIds);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'QVAC_RAG_LOAD_FAILED');
    }
  }

  async function runAnalysis(path: string) {
    setError(null);
    setOutput('');
    setStats(null);
    setAnalysis(null);
    setRecommendations([]);
    setAnalysisStartedAt(Date.now());
    setAnalysisElapsedMs(0);
    let initialNetworkState: ConnectivitySnapshot = {};
    let connectionObservedDuringRun = false;
    let networkSubscription: { remove: () => void } | undefined;
    try {
      initialNetworkState = await Network.getNetworkStateAsync();
      networkSubscription = Network.addNetworkStateListener((networkState) => {
        if (networkState.isConnected === true || networkState.isInternetReachable === true) {
          connectionObservedDuringRun = true;
        }
      });
    } catch {
      // Unknown connectivity must never be reported as offline evidence.
    }
    try {
      const result = await qvac.analyzeImage(path, (token) => {
        setOutput((current) => current + token);
      });
      const nextRecommendations = await catalogRag.search(
        buildTourismQuery(result.analysis, result.text),
      );
      const finalNetworkState: ConnectivitySnapshot = await Network.getNetworkStateAsync().catch(
        () => ({}),
      );
      setAnalysis(result.analysis);
      setRecommendations(nextRecommendations);
      setStats(result.stats);
      setRecord(
        createPerformanceRecord({
          recordedAt: new Date().toISOString(),
          deviceModel: Device.modelName ?? 'unknown-android-device',
          androidVersion: String(Platform.Version),
          loadMs,
          promptHash: visionPsyPrompt.sha256,
          promptCategory: visionPsyPrompt.id,
          promptTokens: result.stats.promptTokens,
          generatedTokens: result.stats.generatedTokens,
          emittedTokens: result.stats.emittedTokens,
          timeToFirstToken: result.stats.timeToFirstToken,
          tokensPerSecond: result.stats.tokensPerSecond,
          totalMs: result.totalMs,
          backendDevice: result.stats.backendDevice,
          success: true,
          offline: remainedOffline(
            initialNetworkState,
            finalNetworkState,
            connectionObservedDuringRun,
          ),
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'QVAC_COMPLETION_FAILED');
    } finally {
      networkSubscription?.remove();
      setAnalysisStartedAt(null);
      const photoUri = `file://${path}`;
      let photoDeleted = false;
      try {
        await FileSystem.deleteAsync(photoUri, { idempotent: true });
        const photoInfo = await FileSystem.getInfoAsync(photoUri);
        photoDeleted = !photoInfo.exists;
      } catch {
        photoDeleted = false;
      }
      setPhotoPrivacyState(photoDeleted ? 'DELETED' : 'DELETE_FAILED');
      setImagePath(null);
    }
  }

  if (cameraOpen) {
    return (
      <SafeAreaView style={styles.cameraScreen}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <View style={styles.cameraActions}>
          <ActionButton label="Capturar imagen" onPress={() => void captureImage()} />
          <ActionButton label="Cancelar" onPress={() => setCameraOpen(false)} />
        </View>
      </SafeAreaView>
    );
  }

  // Two labelled groups rather than one run-on list. Running this on a phone in
  // Panamá Oeste showed why: with the demonstration entries appended, twenty
  // Costa Rica entries stood between the traveler and anything within reach of
  // them, which is the opposite of what a location-aware list is for.
  const demoCards = toursForRegions(region?.regionIds ?? [])
    .filter((tour) => tour.source === 'demo-seed')
    .map((tour) => recommendationCard(tour, catalogExperiences));
  const catalogCards = [...demoCards, ...catalogExperiences.map(catalogCard)];
  const recommendationCards = recommendations.map(({ tour }) =>
    recommendationCard(tour, catalogExperiences),
  );
  const selectedCard =
    selectedTourRefId === null
      ? null
      : ([...recommendationCards, ...catalogCards].find(
          (candidate) => candidate.tourRefId === selectedTourRefId,
        ) ?? null);
  const visionBusy = ['DOWNLOADING', 'LOADING', 'RUNNING'].includes(inferenceState);
  const ragBusy = ['DOWNLOADING', 'LOADING', 'RUNNING'].includes(ragState);
  const busy = visionBusy || ragBusy;
  if (selectedCard && selectedSource) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader
          cameraDisabled={busy || inferenceState !== 'READY' || ragState !== 'READY'}
          onCapture={() => {
            setSelectedTourRefId(null);
            void prepareCamera();
          }}
        />
        <ExperienceDetail
          card={selectedCard}
          onBack={() => setSelectedTourRefId(null)}
          source={selectedSource}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader
        cameraDisabled={busy || inferenceState !== 'READY' || ragState !== 'READY'}
        onCapture={() => void prepareCamera()}
      />
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <Text style={styles.eyebrow}>SOVEREIGN TOURISM</Text>
        <Text style={styles.title}>Descubre experiencias sin enviar tu foto a la nube.</Text>

        {analysisStartedAt !== null ? (
          <View style={styles.analysing}>
            <ActivityIndicator color={brand.primary} size="large" />
            <Text style={styles.analysingTitle}>{analysisPhaseLabel(output.length)}</Text>
            <Text style={styles.meta}>
              {formatElapsed(analysisElapsedMs)} · la foto no sale de este teléfono
            </Text>
          </View>
        ) : (
          <>
            {recommendationCards.length > 0 ? (
              <>
                <Text style={styles.resultsTitle}>Recomendado para tu foto</Text>
                {analysis ? (
                  <Text style={styles.meta}>
                    Detectado: {analysis.category}
                    {analysis.destination ? ` · ${analysis.destination}` : ''} · confianza{' '}
                    {Math.round(analysis.confidence * 100)}%
                  </Text>
                ) : null}
                {photoPrivacyState !== 'NO_PHOTO' ? (
                  <Text
                    style={photoPrivacyState === 'DELETE_FAILED' ? styles.error : styles.meta}
                  >
                    Foto temporal: {photoPrivacyState}
                  </Text>
                ) : null}
                <ExperienceList cards={recommendationCards} onSelect={setSelectedTourRefId} />
                {stats ? (
                  <Text style={styles.meta}>
                    TTFT {Math.round(stats.timeToFirstToken ?? 0)} ms ·{' '}
                    {(stats.tokensPerSecond ?? 0).toFixed(1)} tok/s
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                {demoCards.length > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>{regionNotice(region)}</Text>
                    <Text style={styles.meta}>
                      Muestra de demostración escrita para este repositorio. No procede del
                      catálogo de Clik2Trip y no reserva cupo real.
                    </Text>
                    <ExperienceList cards={demoCards} onSelect={setSelectedTourRefId} />
                  </>
                ) : (
                  <Text style={styles.meta}>{regionNotice(region)}</Text>
                )}
                <Text style={styles.sectionTitle}>Catálogo Clik2Trip</Text>
                {catalogError ? <ErrorNotice code={catalogError} /> : null}
                {catalogLoading ? <ActivityIndicator color={brand.primary} /> : null}
                <ExperienceList
                  cards={catalogExperiences.map(catalogCard)}
                  onSelect={setSelectedTourRefId}
                />
              </>
            )}
          </>
        )}


        {record ? (
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setEvidenceOpen((current) => !current)}
              style={styles.evidenceHeader}
            >
              <Text style={styles.cardTitle}>Evidencia local</Text>
              <Text style={styles.evidenceToggle}>{evidenceOpen ? 'Ocultar' : 'Ver'}</Text>
            </Pressable>
            {evidenceOpen ? (
              <Text selectable style={styles.code}>{JSON.stringify(record, null, 2)}</Text>
            ) : (
              <Text style={styles.meta}>
                Registro reproducible de la corrida: modelo, hardware, tokens, TTFT y rendimiento.
                No contiene la imagen ni datos personales.
              </Text>
            )}
          </View>
        ) : null}

        <QualityEvaluationPanel
          catalogRag={catalogRag}
          ready={inferenceState === 'READY' && ragState === 'READY'}
          vision={qvac}
        />

        {error ? <ErrorNotice code={error} /> : null}
      </ScrollView>
      {onboardingDismissed ? null : (
        <OnboardingFooter
          errorCode={onboardingError ?? error}
          onDismiss={() => setOnboardingDismissed(true)}
          onRetry={retryOnboarding}
          steps={onboardingSteps}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: brand.surface },
  scroll: { flex: 1 },
  content: { padding: space[5], gap: space[4] },
  eyebrow: {
    color: brand.primaryText,
    fontSize: text.xs,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: { color: brand.fg, fontSize: text['2xl'], fontWeight: '800', lineHeight: 34 },
  card: {
    backgroundColor: brand.bg,
    borderColor: brand.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space[3],
    padding: space[5],
  },
  cardTitle: { color: brand.fg, fontSize: text.xl, fontWeight: '700' },
  meta: { color: brand.fgMuted, fontSize: text.sm, lineHeight: 20 },
  button: {
    alignItems: 'center',
    backgroundColor: brand.primary,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: space[4],
  },
  buttonDisabled: { backgroundColor: brand.disabledBg },
  pressed: { backgroundColor: brand.primaryPressed },
  buttonText: { color: brand.onPrimary, fontSize: text.base, fontWeight: '700' },
  buttonTextDisabled: { color: brand.disabledFg },
  analysing: {
    alignItems: 'center',
    backgroundColor: brand.bg,
    borderColor: brand.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space[3],
    paddingHorizontal: space[5],
    paddingVertical: space[8],
  },
  analysingTitle: {
    color: brand.fg,
    fontSize: text.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  resultsTitle: { color: brand.fg, fontSize: text.xl, fontWeight: '700' },
  sectionTitle: {
    color: brand.fg,
    fontSize: text.xl,
    fontWeight: '800',
    marginTop: space[2],
  },
  evidenceHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  evidenceToggle: { color: brand.primaryText, fontSize: text.sm, fontWeight: '700' },
  error: {
    backgroundColor: brand.dangerSoft,
    borderRadius: radius.md,
    color: brand.danger,
    padding: space[4],
  },
  code: {
    color: brand.fgMuted,
    fontFamily: Platform.select({ android: 'monospace', default: undefined }),
    fontSize: 11,
    lineHeight: 16,
  },
  cameraScreen: { flex: 1, backgroundColor: '#000000' },
  camera: { flex: 1 },
  cameraActions: { backgroundColor: brand.secondaryDeep, gap: space[2] + 2, padding: space[5] },
});
