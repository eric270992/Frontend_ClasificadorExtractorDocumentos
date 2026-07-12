import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';
import { RespuestaConsulta } from '../models/factura.models';

@Injectable({ providedIn: 'root' })
export class ConsultasService {
  private readonly http = inject(HttpClient);

  /** Envía una pregunta en lenguaje natural al agente Consultor. */
  preguntar(pregunta: string): Observable<RespuestaConsulta> {
    return this.http.post<RespuestaConsulta>(`${API_BASE}/consultas`, { pregunta });
  }
}
