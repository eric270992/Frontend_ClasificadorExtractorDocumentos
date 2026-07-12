import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';

import { ConsultasService } from '../../core/services/consultas.service';
import { RespuestaConsulta } from '../../core/models/factura.models';

interface MissatgeXat {
  autor: 'usuari' | 'assistent';
  text: string;
  sql?: string;
  filas?: Record<string, unknown>[];
  columnas?: string[];
  error?: boolean;
}

@Component({
  selector: 'app-consultor',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TextareaModule],
  templateUrl: './consultor.html',
  styleUrl: './consultor.scss',
})
export class Consultor {
  private readonly consultasService = inject(ConsultasService);

  readonly missatges = signal<MissatgeXat[]>([]);
  readonly pregunta = signal('');
  readonly esperant = signal(false);

  readonly suggeriments = [
    'Quant hem gastat per proveïdor?',
    'Quines factures estan pendents de revisió?',
    'Quantes factures hi ha rebutjades i per quins motius?',
    'Quina és la factura més cara?',
  ];

  usarSuggeriment(s: string): void {
    this.pregunta.set(s);
    this.enviar();
  }

  enviar(): void {
    const text = this.pregunta().trim();
    if (!text || this.esperant()) {
      return;
    }

    this.missatges.update((m) => [...m, { autor: 'usuari', text }]);
    this.pregunta.set('');
    this.esperant.set(true);

    this.consultasService.preguntar(text).subscribe({
      next: (r: RespuestaConsulta) => {
        this.missatges.update((m) => [
          ...m,
          { autor: 'assistent', text: r.respuesta, sql: r.sql, filas: r.filas, columnas: r.columnas },
        ]);
        this.esperant.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const motiu = err.error?.motivo ?? err.message ?? 'Error desconegut';
        this.missatges.update((m) => [
          ...m,
          { autor: 'assistent', text: motiu, sql: err.error?.sqlGenerado, error: true },
        ]);
        this.esperant.set(false);
      },
    });
  }

  onEnter(e: Event): void {
    const ev = e as KeyboardEvent;
    if (!ev.shiftKey) {
      ev.preventDefault();
      this.enviar();
    }
  }
}
