import { Component } from '@angular/core';
import { Documentos } from './features/documentos/documentos';
import { Consultor } from './features/consultor/consultor';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Documentos, Consultor],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
