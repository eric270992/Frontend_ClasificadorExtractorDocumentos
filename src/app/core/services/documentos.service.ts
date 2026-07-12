import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';
import { FacturaDetalle, FacturaResumen, ResultadoIngesta } from '../models/factura.models';

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly http = inject(HttpClient);

  /** Sube un PDF y ejecuta el pipeline completo (ingesta → extracción → validación → staging). */
  subirDocumento(pdf: File): Observable<ResultadoIngesta> {
    const form = new FormData();
    form.append('pdf', pdf, pdf.name);
    return this.http.post<ResultadoIngesta>(`${API_BASE}/documentos`, form);
  }

  listarFacturas(): Observable<FacturaResumen[]> {
    return this.http.get<FacturaResumen[]>(`${API_BASE}/facturas`);
  }

  obtenerFactura(id: number): Observable<FacturaDetalle> {
    return this.http.get<FacturaDetalle>(`${API_BASE}/facturas/${id}`);
  }
}
