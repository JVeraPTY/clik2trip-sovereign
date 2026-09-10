/**
 * Turns the codes this app refuses with, and the raw errors WDK and the bundler
 * throw, into something a traveler can read. The technical code is never
 * discarded: the interface shows it beside the sentence so a demo, a bug report
 * and an evidence run all keep the exact identifier.
 */
const messages: Record<string, string> = {
  // Deterministic Policy Engine refusals.
  DEMO_MAINNET_FORBIDDEN: 'Este demo solo opera en la red de pruebas Sepolia.',
  CHECKOUT_EXPIRED: 'El resumen de pago caducó. Prepáralo de nuevo.',
  HOLD_EXPIRING: 'Queda muy poco tiempo de reserva para pagar con seguridad.',
  CHAIN_MISMATCH: 'La red no coincide con la del resumen autorizado.',
  TOKEN_MISMATCH: 'El token no coincide con el del resumen autorizado.',
  RECIPIENT_MISMATCH: 'El destino no coincide con el del resumen autorizado.',
  AMOUNT_MISMATCH: 'El importe no coincide con el del resumen autorizado.',
  STATEMENT_HASH_MISMATCH: 'El resumen cambió después de mostrarse. No se pagará.',
  HUMAN_AUTHORIZATION_REQUIRED: 'Hace falta tu autorización para continuar.',
  AUTHORIZATION_EXPIRED: 'Tu autorización caducó. Vuelve a autorizar.',
  BUDGET_EXCEEDED: 'El importe supera el límite permitido en este demo.',

  // Independent settlement verification.
  TRANSACTION_FAILED: 'La transacción se registró como fallida en la red.',
  SENDER_MISMATCH: 'Quien envió los fondos no es la cuenta esperada.',
  FINALITY_PENDING: 'La red aún no confirmó lo suficiente. Sigue verificando.',
  TRANSACTION_ALREADY_USED: 'Esa transacción ya se usó para otra reserva.',

  // Checkout preparation.
  SALDO_USDT_PRUEBA_INSUFICIENTE: 'No hay suficientes USD₮ de prueba para el importe y la comisión.',
  COMISION_EXCEDE_LIMITE: 'La comisión de red supera el límite del demo. Inténtalo más tarde.',
  TRANSFER_ALREADY_ATTEMPTED: 'Ya se intentó un pago para esta reserva. No se repetirá.',
  SANDBOX_CURRENCY_UNSUPPORTED: 'Esta moneda no se puede liquidar en el sandbox.',
  TARIFA_SANDBOX_INVALIDA:
    'La tarifa sandbox configurada no es válida. Se usa el nominal de prueba por defecto.',
  HOLD_ID_INVALID: 'La reserva no tiene un identificador utilizable.',
  WALLET_NOT_READY: 'Abre la wallet de prueba antes de preparar el pago.',

  // Server hold revalidation.
  HOLD_IDENTITY_MISMATCH: 'La reserva del servidor no es la que tenías en pantalla.',
  HOLD_NOT_ACTIVE: 'La reserva ya no está activa.',
  HOLD_SNAPSHOT_MISMATCH: 'El precio o el cupo cambiaron en el servidor.',
  SIN_DISPONIBILIDAD: 'Ese horario ya no tiene cupo disponible.',
  CATALOGO_LOCAL_DESACTUALIZADO: 'Esta experiencia cambió en el catálogo. Vuelve a abrirla.',
  HOLD_EXPIRY_MISSING: 'La reserva llegó sin fecha de expiración. No se puede pagar.',
  DATOS_CLIENTE_INVALIDOS: 'Revisa el nombre y el correo antes de continuar.',

  // No network. The settlement is the one step that genuinely needs it: the
  // balance, the fee quote and the verification are all read from the chain.
  // Everything the app is actually about — the analysis and the local
  // recommendation — keeps working without it, so the sentence says so.
  PAGO_REQUIERE_CONEXION:
    'La liquidación necesita conexión. El análisis y la recomendación local siguen funcionando sin red.',

  // WDK and bundler.
  WDK_BALANCE_FAILED: 'No se pudo leer el saldo de la wallet de prueba.',
  WDK_FEE_QUOTE_FAILED: 'No se pudo calcular la comisión de red.',
  WDK_SEND_FAILED: 'La wallet no pudo enviar la transferencia.',
  BUNDLER_ERROR: 'El servicio de red no respondió. Vuelve a intentarlo.',

  // Camera and on-device inference.
  CAMERA_PERMISSION_DENIED: 'Concede el permiso de cámara para continuar.',
  CAMERA_CAPTURE_FAILED: 'No se pudo capturar la imagen.',
  QVAC_LOAD_FAILED: 'No se pudo cargar el modelo de visión en el dispositivo.',
  QVAC_RAG_LOAD_FAILED: 'No se pudo preparar el catálogo local.',
  QVAC_COMPLETION_FAILED: 'El análisis local no pudo completarse.',
};

const fallback = 'Algo no salió como esperábamos. El detalle técnico está abajo.';

/**
 * The resolver and socket failures that surface, verbatim and unexplained, when
 * the device has no route to the network. A phone in airplane mode showed
 * `EAI_NODATA` on the settlement screen with the generic fallback beside it,
 * which told the traveler nothing about the one thing that was wrong.
 */
const networkFailureCodes = new Set([
  'EAI_NODATA',
  'EAI_NONAME',
  'EAI_AGAIN',
  'EAI_FAIL',
  'ENOTFOUND',
  'ENETUNREACH',
  'ENETDOWN',
  'EHOSTUNREACH',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'Network request failed',
]);

export function isNetworkFailure(code: string): boolean {
  return networkFailureCodes.has(code);
}

export interface ReadableError {
  /** A sentence for the traveler. */
  message: string;
  /** The original identifier, kept verbatim for evidence and bug reports. */
  code: string;
}

/**
 * WDK and the bundler surface errors as a JSON envelope such as
 * `{"code":"BUNDLER_ERROR","message":"..."}`. Pull the code out when present so
 * the raw envelope never reaches the screen.
 */
function extractCode(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && 'code' in parsed) {
        const code = (parsed as { code: unknown }).code;
        if (typeof code === 'string' && code.length > 0) return code;
      }
    } catch {
      // Not JSON after all; fall through to the raw string.
    }
  }
  return trimmed;
}

export function toReadableError(raw: string): ReadableError {
  const code = extractCode(raw);
  if (isNetworkFailure(code)) {
    // The libc code is kept verbatim beside the sentence, the way every other
    // code is: an evidence run must still record exactly what failed.
    return { message: messages.PAGO_REQUIERE_CONEXION ?? fallback, code };
  }
  return { message: messages[code] ?? fallback, code };
}

export function hasReadableMessage(code: string): boolean {
  return code in messages || isNetworkFailure(code);
}
