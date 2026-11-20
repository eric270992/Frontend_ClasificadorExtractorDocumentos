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
}
