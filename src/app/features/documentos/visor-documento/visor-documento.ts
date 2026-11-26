import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';

import { DocumentosService } from '../../../core/services/documentos.service';
import { CampoLocalizado, MetodoGrounding, ResultadoGrounding } from '../../../core/models/factura.models';

/** Color de cada GRUP de camps (no de cada camp): amb 40 línies, un color per camp seria impossible de distingir.
 *  Es decideix pel prefix de la clau del camp ('emisor.nif' → 'emisor'). */
const COLORES_GRUPO: Record<string, string> = {
  emisor: '#2563eb',   // blau
  receptor: '#7c3aed', // lila
  factura: '#ea580c',  // taronja
  totales: '#16a34a',  // verd
  lineas: '#db2777',   // rosa
};
const COLOR_DESCONOCIDO = '#64748b';

/**
 * Visor del document amb les zones d'on ha sortit cada dada pintades per colors (prova de grounding).
 *
 * És un component a part (i no més codi dins Documentos) perquè té el seu propi estat (pàgina, mètode,
 * camp seleccionat) i perquè, si la prova funciona, es podrà reutilitzar a qualsevol pantalla de factura.
 *
 * Com es pinten les caixes: la imatge ocupa el 100% de l'amplada del contenidor (position: relative) i cada caixa
 * és un div absolut amb left/top/width/height en PERCENTATGE. Com que el backend dona les caixes normalitzades 0-1,
 * n'hi ha prou de multiplicar per 100: no cal saber la mida real de la imatge ni recalcular res si canvia el zoom.
 */
@Component({
  selector: 'app-visor-documento',
  standalone: true,
  imports: [FormsModule, ButtonModule, SelectButtonModule, MessageModule, ProgressBarModule],
  templateUrl: './visor-documento.html',
  styleUrl: './visor-documento.scss',
})
export class VisorDocumento implements OnInit {
  private readonly documentosService = inject(DocumentosService);

  /** Factura de la qual es mostra el document. */
  readonly facturaId = input.required<number>();

  readonly opcionesMetodo: { label: string; value: MetodoGrounding }[] = [
    { label: 'Híbrid (text PDF)', value: 'hibrido' },
    { label: 'LLM (visió)', value: 'llm' },
  ];

  readonly metodo = signal<MetodoGrounding>('hibrido');
  readonly resultado = signal<ResultadoGrounding | null>(null);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly paginaActual = signal(1);
  /** Camp ressaltat (per clic a la llegenda o a la caixa). null = cap. */
  readonly campoSeleccionado = signal<string | null>(null);

  /** Caixes de la pàgina que s'està veient. computed: es recalcula sol quan canvia el resultat o la pàgina. */
  readonly cajasPagina = computed(() =>
    (this.resultado()?.campos ?? []).filter((campo) => campo.caja !== null && campo.pagina === this.paginaActual()),
  );

  /** Comptadors per al resum: quants camps s'han localitzat del total. */
  readonly numLocalizados = computed(() => (this.resultado()?.campos ?? []).filter((campo) => campo.caja !== null).length);
  readonly numCampos = computed(() => this.resultado()?.campos.length ?? 0);

  readonly urlPagina = computed(() => this.documentosService.urlPaginaFactura(this.facturaId(), this.paginaActual()));

  ngOnInit(): void {
    // Es comença pel mètode híbrid: és instantani i no gasta crides al model
    this.cargar();
  }

  /** Es crida en iniciar i cada vegada que l'usuari canvia de mètode al selector. */
  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.campoSeleccionado.set(null);

    this.documentosService.obtenerGrounding(this.facturaId(), this.metodo()).subscribe({
      next: (resultado) => {
        this.resultado.set(resultado);
        // Si la pàgina que es mirava ja no existeix (no hauria de passar), es torna a la primera
        if (this.paginaActual() > Math.max(resultado.numPaginas, 1)) {
          this.paginaActual.set(1);
        }
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(typeof error.error === 'string' ? error.error : 'No s\'ha pogut calcular d\'on surt cada dada.');
        this.cargando.set(false);
      },
    });
  }

  cambiarPagina(desplazamiento: number): void {
    const numPaginas = this.resultado()?.numPaginas ?? 1;
    const nueva = this.paginaActual() + desplazamiento;
    if (nueva >= 1 && nueva <= numPaginas) {
      this.paginaActual.set(nueva);
    }
  }

  /** Clic a la llegenda o a una caixa: es ressalta el camp i, si és en una altra pàgina, s'hi salta.
   *  Un segon clic sobre el mateix camp el deixa de ressaltar. */
  seleccionar(campo: CampoLocalizado): void {
    if (this.campoSeleccionado() === campo.campo) {
      this.campoSeleccionado.set(null);
      return;
    }
    this.campoSeleccionado.set(campo.campo);
    if (campo.pagina !== null) {
      this.paginaActual.set(campo.pagina);
    }
  }

  color(campo: CampoLocalizado): string {
    const grupo = campo.campo.split(/[.[]/)[0];
    return COLORES_GRUPO[grupo] ?? COLOR_DESCONOCIDO;
  }

  /** Estil de posició de la caixa, en percentatges de la imatge (vegeu el comentari de la classe). */
  estiloCaja(campo: CampoLocalizado): Record<string, string> {
    const caja = campo.caja!;
    const color = this.color(campo);
    return {
      left: `${caja.x1 * 100}%`,
      top: `${caja.y1 * 100}%`,
      width: `${(caja.x2 - caja.x1) * 100}%`,
      height: `${(caja.y2 - caja.y1) * 100}%`,
      'border-color': color,
      // Fons semitransparent del mateix color (els dos últims dígits hex són l'opacitat: 33 ≈ 20%)
      'background-color': `${color}33`,
    };
  }

  /** Text explicatiu de cada camp a la llegenda: on s'ha trobat i, si cal, per què pot ser dubtós. */
  detalleCampo(campo: CampoLocalizado): string {
    if (campo.caja === null) {
      return 'no localitzat al document';
    }
    const partes = [`pàg. ${campo.pagina}`];
    if (campo.puntuacion !== null && campo.puntuacion < 1) {
      partes.push(`semblança ${Math.round(campo.puntuacion * 100)}%`);
    }
    if (campo.numCandidatos !== null && campo.numCandidatos > 1) {
      partes.push(`${campo.numCandidatos} aparicions, s'ha triat una`);
    }
    return partes.join(' · ');
  }
}
