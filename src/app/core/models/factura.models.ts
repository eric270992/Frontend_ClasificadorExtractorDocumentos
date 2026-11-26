// Contratos que devuelve la API .NET (camelCase por la serialización por defecto de ASP.NET).

export type EstadoFactura =
  | 'PendienteValidacion'
  | 'Validada'
  | 'RevisionHumana'
  | 'Rechazada'
  | 'IntegradaERP';

export interface Incidencia {
  codigo: string;
  detalle: string;
  severidad?: string;
}

/** Una edición manual de un campo, registrada en el historial de auditoría. */
export interface HistorialCambio {
  campo: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  fechaCambio: string;
  usuario: string;
}

/** Respuesta de POST /documentos cuando el pipeline se ejecuta. */
export interface ResultadoIngesta {
  documentoId: string;
  facturaId: number | null;
  estado: EstadoFactura;
  incidencias: Incidencia[];
}

/** Fila de GET /facturas. */
export interface FacturaResumen {
  id: number;
  proveedor: string | null;
  nifProveedor: string | null;
  numeroFactura: string;
  fechaFactura: string;
  moneda: string;
  total: number;
  estado: EstadoFactura;
  numIncidencias: number;
  fechaIngesta: string;
}

export interface FacturaLinea {
  /** Necessari per dir al backend quina línia es modifica en editar. */
  id: number;
  numLinea: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  /** null = el document no indicava el %IVA d'aquesta línia (no és el mateix que 0%, exempt). */
  porcentajeIva: number | null;
  importeLinea: number;
}

/** Respuesta de GET /facturas/{id}. */
export interface FacturaDetalle {
  id: number;
  proveedor: { nif: string; nombre: string } | null;
  /** Receptor de la factura (quien paga). Cada campo puede faltar por separado. */
  cliente: { nif: string | null; nombre: string | null } | null;
  numeroFactura: string;
  fechaFactura: string;
  fechaVencimiento: string | null;
  moneda: string;
  baseImponible: number;
  cuotaIva: number;
  retencionIrpf: number | null;
  total: number;
  reverseCharge: boolean;
  /** true = els imports de línia ja porten l'IVA (tiquets): la suma de línies és el total.
   *  false = no el porten (factures): la suma de línies és la base. Ve del JSON de l'extracció. */
  lineasIncluyenIva: boolean;
  estado: EstadoFactura;
  nivelExtraccion: number;
  fechaIngesta: string;
  fechaAprobacionManual: string | null;
  lineas: FacturaLinea[];
  incidencias: (Incidencia & { fechaCreacion: string })[];
  historial: HistorialCambio[];
}

/** Cuerpo de PUT /facturas/{id}: los campos editables a mano. No incluye el proveedor. */
export interface ActualizarFacturaRequest {
  nifCliente: string | null;
  nombreCliente: string | null;
  numeroFactura: string;
  fechaFactura: string;
  fechaVencimiento: string | null;
  moneda: string;
  baseImponible: number;
  cuotaIva: number;
  retencionIrpf: number | null;
  total: number;
  reverseCharge: boolean;
  /** Llista completa de línies tal com queden: id null = nova; les que no hi siguin s'eliminen;
   *  l'ordre és el nou ordre. Si no s'envia, el backend no toca les línies. */
  lineas?: LineaEditada[];
}

/** Una línia dins de PUT /facturas/{id}. */
export interface LineaEditada {
  id: number | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  porcentajeIva: number | null;
  importeLinea: number;
}

/** Resposta de PUT /facturas/{id}: estat i incidències després de tornar a passar les regles. */
export interface ResultadoEdicion {
  estado: EstadoFactura;
  /** false = no hi havia cap canvi: no s'ha revalidat ni desat res. */
  huboCambios: boolean;
  incidencias: Incidencia[];
}

/** Respuesta de POST /consultas (éxito). */
export interface RespuestaConsulta {
  respuesta: string;
  explicacion: string | null;
  sql: string;
  numFilas: number;
  columnas: string[];
  filas: Record<string, unknown>[];
}

/** Límits de pujada vigents al backend (GET /configuracion). Es demanen en obrir la pantalla de
 *  documents, de manera que si es canvien al backend, en tornar a entrar ja surt el valor nou. */
export interface ConfiguracionIngesta {
  maxPaginasPorDocumento: number;
  tamanoMaximoMb: number;
  /** Si el backend té el grounding activat (Grounding:Habilitado); si no, s'amaga el botó del visor. */
  groundingHabilitado: boolean;
}

// ── Grounding (prova, feature/grounding): d'on ha sortit cada dada dins el document ──

/** Mètode amb què el backend localitza els camps. 'hibrido' = capa de text del PDF (exacte, sense cost de
 *  model); 'llm' = el model de visió marca les caixes (aproximat, però també funciona amb fotos). */
export type MetodoGrounding = 'hibrido' | 'llm';

/** Caixa normalitzada 0-1 sobre la pàgina: (0,0) dalt a l'esquerra, (1,1) baix a la dreta. Es pinta en
 *  percentatges, així no importa la mida a què es mostri la imatge. */
export interface CajaNormalizada {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Un camp de la factura i on s'ha trobat. pagina/caja null = no localitzat al document. */
export interface CampoLocalizado {
  /** Clau estable: 'emisor.nif', 'totales.total', 'lineas[0].importeLinea'... */
  campo: string;
  etiqueta: string;
  valor: string;
  pagina: number | null;
  caja: CajaNormalizada | null;
  /** 1 = coincidència exacta; menys = aproximada. null amb el mètode llm. */
  puntuacion: number | null;
  /** Zones del document que coincidien amb el valor (>1 = s'ha hagut de triar). null amb el mètode llm. */
  numCandidatos: number | null;
}

/** Resposta de GET /facturas/{id}/grounding. */
export interface ResultadoGrounding {
  facturaId: number;
  metodo: MetodoGrounding;
  numPaginas: number;
  campos: CampoLocalizado[];
  duracionMs: number;
  avisos: string[];
}
