import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';
import {
  ActualizarFacturaRequest, ConfiguracionIngesta, FacturaDetalle, FacturaResumen, ResultadoIngesta,
} from '../models/factura.models';

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly http = inject(HttpClient);

  /** Sube un documento (PDF, JPG o PNG) y ejecuta el pipeline completo (ingesta → extracción → validación → staging).
   *  El campo del formulario sigue llamándose 'pdf' por compatibilidad con el backend, aunque sea una imagen. */
  subirDocumento(pdf: File): Observable<ResultadoIngesta> {
    const form = new FormData();
    form.append('pdf', pdf, pdf.name);
    return this.http.post<ResultadoIngesta>(`${API_BASE}/documentos`, form);
  }

  /** Demana al backend els límits actuals (pàgines i mida). No es guarda enlloc: cada vegada que
   *  s'obre la pantalla es torna a demanar, així sempre es mostra el valor vigent. */
  obtenerConfiguracion(): Observable<ConfiguracionIngesta> {
    return this.http.get<ConfiguracionIngesta>(`${API_BASE}/configuracion`);
  }

  listarFacturas(): Observable<FacturaResumen[]> {
    return this.http.get<FacturaResumen[]>(`${API_BASE}/facturas`);
  }

  obtenerFactura(id: number): Observable<FacturaDetalle> {
    return this.http.get<FacturaDetalle>(`${API_BASE}/facturas/${id}`);
  }

  /** Aprobación manual: solo válida si la factura está en RevisionHumana. */
  aprobarFactura(id: number): Observable<void> {
    return this.http.post<void>(`${API_BASE}/facturas/${id}/aprobar`, null);
  }

  /** Eliminación lógica (soft delete): deja de aparecer en el listado. */
  eliminarFactura(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/facturas/${id}`);
  }

  /** Edición manual de los campos extraídos: solo válida si la factura está en Validada o
   * RevisionHumana. Cada campo modificado queda registrado en el historial de auditoría. */
  actualizarFactura(id: number, request: ActualizarFacturaRequest): Observable<void> {
    return this.http.put<void>(`${API_BASE}/facturas/${id}`, request);
  }
}
