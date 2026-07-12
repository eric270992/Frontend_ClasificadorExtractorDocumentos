import { EstadoFactura } from './models/factura.models';

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

/** Mapea el estado de la factura al color/etiqueta del Tag de PrimeNG. */
export function severidadEstado(estado: EstadoFactura): Severity {
  switch (estado) {
    case 'Validada':
      return 'success';
    case 'RevisionHumana':
      return 'warn';
    case 'Rechazada':
      return 'danger';
    case 'IntegradaERP':
      return 'contrast';
    default:
      return 'info';
  }
}

/** Texto legible del estado para mostrar al usuario. */
export function etiquetaEstado(estado: EstadoFactura): string {
  switch (estado) {
    case 'PendienteValidacion':
      return 'Pendent validació';
    case 'Validada':
      return 'Validada';
    case 'RevisionHumana':
      return 'Revisió humana';
    case 'Rechazada':
      return 'Rebutjada';
    case 'IntegradaERP':
      return 'Integrada ERP';
    default:
      return estado;
  }
}
