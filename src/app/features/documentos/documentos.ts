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
  ActualizarFacturaRequest, ConfiguracionIngesta, FacturaDetalle, FacturaResumen, LineaEditada,
} from '../../core/models/factura.models';
import { etiquetaEstado, severidadEstado } from '../../core/estado-ui';

/** Estados sobre los que tiene sentido editar los campos extraídos a mano. */
const ESTADOS_EDITABLES = ['Validada', 'RevisionHumana'];

/** Mateixa tolerància que el backend (ContextoValidacion.ToleranciaCuadre): ±0,02 € per arrodoniments. */
const TOLERANCIA_CUADRE = 0.02;

/** Arrodoniment a cèntims. Number.EPSILON evita que 1.005 * 100 = 100.49999… arrodoneixi cap avall. */
function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

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
  /** Avís que es mostra DINS el diàleg d'edició (el de mensajeSubida queda darrere del diàleg i no es veu). */
  readonly avisoEdicion = signal<string | null>(null);
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
      // Còpia de les línies (no la referència): si es cancel·la, el detall original queda intacte
      lineas: d.lineas.map((l) => ({
        id: l.id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        porcentajeIva: l.porcentajeIva,
        importeLinea: l.importeLinea,
      })),
    };
    this.avisoEdicion.set(null);
    this.editando.set(true);
  }

  cancelarEdicion(): void {
    this.avisoEdicion.set(null);
    this.editando.set(false);
    this.edicion = null;
  }

  // ── Edició de línies ─────────────────────────────────────────────
  /** Línia nova al final. Proposa el %IVA de l'última línia, que sol ser el mateix. */
  anadirLinea(): void {
    const lineas = this.edicion?.lineas;
    if (!lineas) {
      return;
    }
    const ultimoIva = lineas.length ? lineas[lineas.length - 1].porcentajeIva : null;
    lineas.push({ id: null, descripcion: '', cantidad: 1, precioUnitario: 0, porcentajeIva: ultimoIva, importeLinea: 0 });
  }

  eliminarLinea(index: number): void {
    this.edicion?.lineas?.splice(index, 1);
  }

  /** L'usuari ha canviat la quantitat d'una línia: es desa el valor nou i es recalcula l'import. */
  cambiarCantidad(linea: LineaEditada, cantidadNueva: number): void {
    linea.cantidad = cantidadNueva;
    this.recalcularImporte(linea);
  }

  /** L'usuari ha canviat el preu unitari d'una línia: es desa el valor nou i es recalcula l'import. */
  cambiarPrecioUnitario(linea: LineaEditada, precioNuevo: number): void {
    linea.precioUnitario = precioNuevo;
    this.recalcularImporte(linea);
  }

  /** Import de la línia = quantitat × preu, arrodonit a cèntims.
   *  Només es crida en canviar quantitat o preu. Si l'usuari escriu l'import a mà (un descompte,
   *  un arrodoniment de la factura), aquest valor es respecta i no es torna a calcular. */
  recalcularImporte(linea: LineaEditada): void {
    // Si el camp està buit mentre l'usuari escriu, el valor és null: es compta com 0
    const cantidad = linea.cantidad ?? 0;
    const precioUnitario = linea.precioUnitario ?? 0;
    linea.importeLinea = redondear2(cantidad * precioUnitario);
  }

  /** Suma dels imports de totes les línies que s'estan editant. */
  sumaLineas(): number {
    if (!this.edicion?.lineas) {
      return 0;
    }

    let suma = 0;
    for (const linea of this.edicion.lineas) {
      suma = suma + (linea.importeLinea ?? 0);
    }
    return redondear2(suma);
  }

  /**
   * Indica si la suma de les línies quadra amb la capçalera, per mostrar-ho en temps real.
   * Només és una ajuda: qui decideix de debò és el backend en desar (les mateixes regles que a la ingesta).
   * El frontend no sap si els imports de línia porten l'IVA inclòs, per això es comproven els dos casos:
   *  - 'base'       → la suma coincideix amb la base imposable (imports sense IVA)
   *  - 'baseMasIva' → la suma coincideix amb base + IVA (imports amb IVA inclòs)
   *  - null         → no quadra amb cap dels dos
   */
  cuadreLineas(): 'base' | 'baseMasIva' | null {
    const facturaEditada = this.edicion;
    if (!facturaEditada) {
      return null;
    }

    const sumaLineas = this.sumaLineas();
    const baseImponible = facturaEditada.baseImponible ?? 0;
    const cuotaIva = facturaEditada.cuotaIva ?? 0;

    const diferenciaConBase = Math.abs(sumaLineas - baseImponible);
    if (diferenciaConBase <= TOLERANCIA_CUADRE) {
      return 'base';
    }

    const diferenciaConBaseMasIva = Math.abs(sumaLineas - (baseImponible + cuotaIva));
    if (diferenciaConBaseMasIva <= TOLERANCIA_CUADRE) {
      return 'baseMasIva';
    }

    return null;
  }

  /**
   * Botó "Recalcular capçalera": torna a calcular base, IVA i total a partir de les línies.
   * No és automàtic a propòsit: els totals de capçalera són els del document i serveixen per detectar errors.
   *
   * La suma de línies vol dir una cosa diferent segons el document:
   *  - Tiquet (les línies ja porten l'IVA):    suma de línies = TOTAL
   *  - Factura (les línies no porten l'IVA):   suma de línies = BASE
   * Ho sabem pel camp lineasIncluyenIva, que ve del backend (el va extreure el model en llegir el PDF).
   */
  recalcularCabeceraDesdeLineas(): void {
    // Cada clic comença net: si ara ja es pot calcular tot, l'avís anterior desapareix
    this.avisoEdicion.set(null);

    const facturaEditada = this.edicion;
    const facturaOriginal = this.detalle();
    if (!facturaEditada?.lineas || facturaEditada.lineas.length === 0 || !facturaOriginal) {
      return;
    }

    if (facturaOriginal.lineasIncluyenIva) {
      this.recalcularCabeceraConIvaIncluido(facturaEditada);
    } else {
      this.recalcularCabeceraSinIvaIncluido(facturaEditada);
    }
  }

  /** Tiquet: les línies ja porten l'IVA, per tant la suma de línies és el total. */
  private recalcularCabeceraConIvaIncluido(facturaEditada: ActualizarFacturaRequest): void {
    const sumaLineas = this.sumaLineas();
    const retencionIrpf = facturaEditada.retencionIrpf ?? 0;

    // 1. El total sempre es pot calcular: és la suma de línies (menys IRPF, si n'hi ha)
    facturaEditada.total = redondear2(sumaLineas - retencionIrpf);

    // 2. Per separar base i IVA cal el %IVA de cada línia. Si en falta algun, no s'inventa: s'avisa.
    if (!this.todasLasLineasTienenIva()) {
      this.avisoEdicion.set(
        "Total recalculat. La base i l'IVA no es poden calcular perquè hi ha línies sense %IVA: revisa-les a mà.");
      return;
    }

    // 3. Base de cada línia = import / (1 + %IVA / 100). Exemple: 12,10 al 21% → 12,10 / 1,21 = 10,00
    let baseImponible = 0;
    for (const linea of facturaEditada.lineas ?? []) {
      const importeLinea = linea.importeLinea ?? 0;
      const porcentajeIva = linea.porcentajeIva ?? 0;
      baseImponible = baseImponible + importeLinea / (1 + porcentajeIva / 100);
    }
    baseImponible = redondear2(baseImponible);

    // 4. L'IVA és el que queda: suma de línies (amb IVA) menys la base (sense IVA)
    facturaEditada.baseImponible = baseImponible;
    facturaEditada.cuotaIva = redondear2(sumaLineas - baseImponible);
  }

  /** Factura: les línies no porten l'IVA, per tant la suma de línies és la base. */
  private recalcularCabeceraSinIvaIncluido(facturaEditada: ActualizarFacturaRequest): void {
    // 1. La base sempre es pot calcular: és la suma de línies
    const baseImponible = this.sumaLineas();
    facturaEditada.baseImponible = baseImponible;

    // 2. Per calcular l'IVA cal el %IVA de cada línia. Si en falta algun, no s'inventa: s'avisa.
    if (!this.todasLasLineasTienenIva()) {
      this.avisoEdicion.set(
        "Base recalculada. L'IVA i el total no es poden calcular perquè hi ha línies sense %IVA: revisa'ls a mà.");
      return;
    }

    // 3. IVA = suma de (import de la línia × %IVA de la línia / 100)
    let cuotaIva = 0;
    for (const linea of facturaEditada.lineas ?? []) {
      const importeLinea = linea.importeLinea ?? 0;
      const porcentajeIva = linea.porcentajeIva ?? 0;
      cuotaIva = cuotaIva + (importeLinea * porcentajeIva) / 100;
    }
    cuotaIva = redondear2(cuotaIva);

    // 4. Total = base + IVA − retenció d'IRPF (si n'hi ha)
    const retencionIrpf = facturaEditada.retencionIrpf ?? 0;
    facturaEditada.cuotaIva = cuotaIva;
    facturaEditada.total = redondear2(baseImponible + cuotaIva - retencionIrpf);
  }

  /** true si totes les línies tenen %IVA. Buit (null) vol dir "el document no l'indica", no 0%. */
  private todasLasLineasTienenIva(): boolean {
    for (const linea of this.edicion?.lineas ?? []) {
      if (linea.porcentajeIva === null) {
        return false;
      }
    }
    return true;
  }

  guardarEdicion(): void {
    const d = this.detalle();
    if (!d || !this.edicion) {
      return;
    }
    // Comprovació ràpida abans d'enviar; el backend la torna a fer igualment
    const sinDescripcion = (this.edicion.lineas ?? []).findIndex((l) => !l.descripcion?.trim());
    if (sinDescripcion >= 0) {
      this.mensajeSubida.set({ tipo: 'error', texto: `La línia ${sinDescripcion + 1} no té descripció.` });
      return;
    }

    this.guardando.set(true);
    this.documentosService.actualizarFactura(d.id, this.edicion).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.editando.set(false);
        this.edicion = null;
        // El backend ha tornat a passar les regles: es mostra com ha quedat la factura
        const texto = !r.huboCambios
          ? `Factura ${d.numeroFactura}: no hi havia cap canvi.`
          : `Factura ${d.numeroFactura} actualitzada → ${etiquetaEstado(r.estado)}` +
            (r.incidencias.length ? ` · ${r.incidencias.length} incidència(es)` : ' · sense incidències');
        const tipo = r.huboCambios && r.incidencias.length ? 'warn' : 'success';
        this.mensajeSubida.set({ tipo, texto });
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
  /** "Aprovar igualment" des de la llista. Només hi ha el nombre d'incidències, no el detall. */
  aprobar(f: FacturaResumen): void {
    const avis = f.numIncidencias > 0
      ? `Té ${f.numIncidencias} incidència(es) pendent(s) de revisió.\n`
      : '';
    this.confirmarYAprobar(f.id, f.numeroFactura, avis);
  }

  /** "Aprovar igualment" des del detall: aquí es poden llistar les incidències pendents. */
  aprobarDetalle(d: FacturaDetalle): void {
    const avis = d.incidencias.length
      ? `Incidències pendents:\n${d.incidencias.map((i) => `· ${i.codigo}: ${i.detalle}`).join('\n')}\n`
      : '';
    this.confirmarYAprobar(d.id, d.numeroFactura, avis);
  }

  /** L'aprovació queda registrada a l'historial juntament amb les incidències que quedaven pendents. */
  private confirmarYAprobar(id: number, numeroFactura: string, avis: string): void {
    if (!confirm(`${avis}\nVols aprovar igualment la factura ${numeroFactura}? Quedarà registrat a l'historial.`)) {
      return;
    }
    this.documentosService.aprobarFactura(id).subscribe({
      next: () => {
        this.mensajeSubida.set({ tipo: 'success', texto: `Factura ${numeroFactura} aprovada manualment.` });
        // Si el detall d'aquesta factura és obert, es recarrega (estat nou + historial)
        if (this.detalle()?.id === id) {
          this.documentosService.obtenerFactura(id).subscribe({ next: (nou) => this.detalle.set(nou) });
        }
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
