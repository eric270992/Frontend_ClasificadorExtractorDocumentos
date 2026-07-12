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
  numLinea: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  porcentajeIva: number;
  importeLinea: number;
}

/** Respuesta de GET /facturas/{id}. */
export interface FacturaDetalle {
  id: number;
  proveedor: { nif: string; nombre: string } | null;
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
  lineas: FacturaLinea[];
  incidencias: (Incidencia & { fechaCreacion: string })[];
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
