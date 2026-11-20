import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, interval, switchMap } from 'rxjs';

import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageModule } from 'primeng/message';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';

import { DocumentosService } from '../../core/services/documentos.service';
import {
  ActualizarFacturaRequest, ConfiguracionIngesta, FacturaDetalle, FacturaResumen,
} from '../../core/models/factura.models';
import { etiquetaEstado, severidadEstado } from '../../core/estado-ui';

/** Estados sobre los que tiene sentido editar los campos extraídos a mano. */
const ESTADOS_EDITABLES = ['Validada', 'RevisionHumana'];

@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, TagModule, ButtonModule, DialogModule, ProgressBarModule,
    MessageModule, InputTextModule, InputNumberModule, CheckboxModule,
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
  /** Límits de pujada. Valors per defecte mentre no arriba la resposta del backend (o si falla):
   *  no és crític, perquè el backend torna a validar quan es puja el fitxer. */
  readonly configuracion = signal<ConfiguracionIngesta>({ maxPaginasPorDocumento: 4, tamanoMaximoMb: 10 });

  readonly mensajeSubida = signal<{ tipo: 'success' | 'error' | 'warn'; texto: string } | null>(null);

  readonly detalle = signal<FacturaDetalle | null>(null);
  readonly detalleVisible = signal(false);

  /** true mientras el diálogo de detalle muestra el formulario editable en lugar de la vista de solo lectura. */
  readonly editando = signal(false);
  readonly guardando = signal(false);
  /** Copia editable de los campos de `detalle()`; solo existe mientras `editando()` es true. */
  edicion: ActualizarFacturaRequest | null = null;

  readonly etiquetaEstado = etiquetaEstado;
  readonly severidadEstado = severidadEstado;

  private pollingSub?: Subscription;

  ngOnInit(): void {
    this.cargarConfiguracion();
    this.refrescar();
    // Refresco por polling simple (sin SignalR en E1, según SPEC E1-F5)
    this.pollingSub = interval(4000)
      .pipe(switchMap(() => this.documentosService.listarFacturas()))
      .subscribe({ next: (f) => this.facturas.set(f) });
  }

  ngOnDestroy(): void {
    this.pollingSub?.unsubscribe();
  }

  /** Mateix patró que refrescar(): crida al servei, subscribe i es desa al signal.
   *  L'Observable de l'HttpClient emet un sol valor i s'acaba sol: no cal unsubscribe. */
  private cargarConfiguracion(): void {
    this.documentosService.obtenerConfiguracion().subscribe({
      next: (c) => this.configuracion.set(c),
      // Si falla, ens quedem amb els valors per defecte: no bloquegem la pantalla per això
      error: () => {},
    });
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
    // Filtre amable al client (tipus MIME o extensió). La validació de debò la fa el backend
    // pels "magic bytes" del fitxer, així que aquí només evitem pujades òbvies que fallarien.
    if (!esFormatoAdmitido(archivo)) {
      this.mensajeSubida.set({ tipo: 'error', texto: 'Només s\'admeten fitxers PDF, JPG o PNG.' });
      return;
    }
    // La mida màxima ara ve del backend en lloc d'estar escrita a mà aquí
    const maxMb = this.configuracion().tamanoMaximoMb;
    if (archivo.size > maxMb * 1024 * 1024) {
      this.mensajeSubida.set({ tipo: 'error', texto: `El fitxer supera els ${maxMb} MB.` });
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

        // 422 = el backend ha rebutjat el document (p. ex. massa pàgines). Tornem a demanar la
        // configuració per si el límit ha canviat mentre l'aplicació estava oberta.
        if (err.status === 422) {
          this.cargarConfiguracion();
        }
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
        this.editando.set(false);
        this.edicion = null;
      },
    });
  }

  // ── Edición manual de los campos extraídos ──────────────────────
  puedeEditar(estado: string): boolean {
    return ESTADOS_EDITABLES.includes(estado);
  }

  iniciarEdicion(): void {
    const d = this.detalle();
    if (!d) {
      return;
    }
    this.edicion = {
      nifCliente: d.cliente?.nif ?? null,
      nombreCliente: d.cliente?.nombre ?? null,
      numeroFactura: d.numeroFactura,
      fechaFactura: d.fechaFactura,
      fechaVencimiento: d.fechaVencimiento,
      moneda: d.moneda,
      baseImponible: d.baseImponible,
      cuotaIva: d.cuotaIva,
      retencionIrpf: d.retencionIrpf,
      total: d.total,
      reverseCharge: d.reverseCharge,
    };
    this.editando.set(true);
  }

  cancelarEdicion(): void {
    this.editando.set(false);
    this.edicion = null;
  }

  guardarEdicion(): void {
    const d = this.detalle();
    if (!d || !this.edicion) {
      return;
    }
    this.guardando.set(true);
    this.documentosService.actualizarFactura(d.id, this.edicion).subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(false);
        this.edicion = null;
        this.mensajeSubida.set({ tipo: 'success', texto: `Factura ${d.numeroFactura} actualitzada.` });
        // Recarrega el detall (camps nous + historial d'auditoria) i la llista
        this.documentosService.obtenerFactura(d.id).subscribe({ next: (nou) => this.detalle.set(nou) });
        this.refrescar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        const detalle = err.error ?? err.message ?? 'Error desconegut';
        this.mensajeSubida.set({ tipo: 'error', texto: `No s'ha pogut desar: ${detalle}` });
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

/** Tipus admesos: PDF (factures) i imatges JPEG/PNG (p. ex. la foto d'un tiquet). Es mira el tipus MIME
 * i, com a alternativa, l'extensió: alguns navegadors/sistemes deixen `file.type` buit. */
const TIPOS_ADMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];
const EXTENSIONES_ADMITIDAS = ['.pdf', '.jpg', '.jpeg', '.png'];

function esFormatoAdmitido(archivo: File): boolean {
  const nombre = archivo.name.toLowerCase();
  return TIPOS_ADMITIDOS.includes(archivo.type) || EXTENSIONES_ADMITIDAS.some((ext) => nombre.endsWith(ext));
}
