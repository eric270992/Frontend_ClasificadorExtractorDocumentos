import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, interval, switchMap } from 'rxjs';

import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageModule } from 'primeng/message';

import { DocumentosService } from '../../core/services/documentos.service';
import { FacturaDetalle, FacturaResumen } from '../../core/models/factura.models';
import { etiquetaEstado, severidadEstado } from '../../core/estado-ui';

@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [
    CommonModule, TableModule, TagModule, ButtonModule, DialogModule, ProgressBarModule, MessageModule,
  ],
  templateUrl: './documentos.html',
  styleUrl: './documentos.scss',
})
export class Documentos implements OnInit, OnDestroy {
  private readonly documentosService = inject(DocumentosService);

  readonly facturas = signal<FacturaResumen[]>([]);
  readonly cargandoLista = signal(false);
  readonly subiendo = signal(false);
  readonly arrastrando = signal(false);
  readonly mensajeSubida = signal<{ tipo: 'success' | 'error' | 'warn'; texto: string } | null>(null);

  readonly detalle = signal<FacturaDetalle | null>(null);
  readonly detalleVisible = signal(false);

  readonly etiquetaEstado = etiquetaEstado;
  readonly severidadEstado = severidadEstado;

  private pollingSub?: Subscription;

  ngOnInit(): void {
    this.refrescar();
    // Refresco por polling simple (sin SignalR en E1, según SPEC E1-F5)
    this.pollingSub = interval(4000)
      .pipe(switchMap(() => this.documentosService.listarFacturas()))
      .subscribe({ next: (f) => this.facturas.set(f) });
  }

  ngOnDestroy(): void {
    this.pollingSub?.unsubscribe();
  }

  refrescar(): void {
    this.cargandoLista.set(true);
    this.documentosService.listarFacturas().subscribe({
      next: (f) => {
        this.facturas.set(f);
        this.cargandoLista.set(false);
      },
      error: () => this.cargandoLista.set(false),
    });
  }

  // ── Drag & drop ────────────────────────────────────────────────
  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.arrastrando.set(true);
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.arrastrando.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.arrastrando.set(false);
    const archivo = e.dataTransfer?.files?.[0];
    if (archivo) {
      this.procesar(archivo);
    }
  }

  onSeleccionArchivo(e: Event): void {
    const input = e.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (archivo) {
      this.procesar(archivo);
    }
    input.value = ''; // permite volver a subir el mismo fichero
  }

  private procesar(archivo: File): void {
    if (archivo.type !== 'application/pdf' && !archivo.name.toLowerCase().endsWith('.pdf')) {
      this.mensajeSubida.set({ tipo: 'error', texto: 'Només s\'admeten fitxers PDF.' });
      return;
    }
    if (archivo.size > 10 * 1024 * 1024) {
      this.mensajeSubida.set({ tipo: 'error', texto: 'El fitxer supera els 10 MB.' });
      return;
    }

    this.subiendo.set(true);
    this.mensajeSubida.set(null);
    this.documentosService.subirDocumento(archivo).subscribe({
      next: (r) => {
        this.subiendo.set(false);
        const estat = etiquetaEstado(r.estado);
        const tipo = r.estado === 'Rechazada' ? 'warn' : 'success';
        const inc = r.incidencias.length ? ` · ${r.incidencias.length} incidència(es)` : '';
        this.mensajeSubida.set({ tipo, texto: `"${archivo.name}" processada → ${estat}${inc}` });
        this.refrescar();
      },
      error: (err: HttpErrorResponse) => {
        this.subiendo.set(false);
        const detalle = err.error?.error ?? err.message ?? 'Error desconegut';
        this.mensajeSubida.set({ tipo: 'error', texto: `No s'ha pogut processar: ${detalle}` });
        this.refrescar();
      },
    });
  }

  // ── Detalle ────────────────────────────────────────────────────
  verDetalle(f: FacturaResumen): void {
    this.documentosService.obtenerFactura(f.id).subscribe({
      next: (d) => {
        this.detalle.set(d);
        this.detalleVisible.set(true);
      },
    });
  }

  // ── Aprobación manual y eliminación ─────────────────────────────
  aprobar(f: FacturaResumen): void {
    this.documentosService.aprobarFactura(f.id).subscribe({
      next: () => {
        this.mensajeSubida.set({ tipo: 'success', texto: `Factura ${f.numeroFactura} aprovada manualment.` });
        this.refrescar();
      },
      error: (err: HttpErrorResponse) => {
        const detalle = err.error ?? err.message ?? 'Error desconegut';
        this.mensajeSubida.set({ tipo: 'error', texto: `No s'ha pogut aprovar: ${detalle}` });
      },
    });
  }

  eliminar(f: FacturaResumen): void {
    const proveedor = f.proveedor ? ` de ${f.proveedor}` : '';
    if (!confirm(`Vols eliminar la factura ${f.numeroFactura}${proveedor}? Deixarà de sortir a la llista.`)) {
      return;
    }
    this.documentosService.eliminarFactura(f.id).subscribe({
      next: () => {
        this.mensajeSubida.set({ tipo: 'success', texto: `Factura ${f.numeroFactura} eliminada.` });
        this.refrescar();
      },
      error: (err: HttpErrorResponse) => {
        const detalle = err.error ?? err.message ?? 'Error desconegut';
        this.mensajeSubida.set({ tipo: 'error', texto: `No s'ha pogut eliminar: ${detalle}` });
      },
    });
  }
}
