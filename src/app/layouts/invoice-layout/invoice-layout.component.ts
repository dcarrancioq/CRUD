import { Component } from '@angular/core';

@Component({
  selector: 'app-invoice-layout',
  templateUrl: './invoice-layout.component.html',
  styleUrls: ['./invoice-layout.component.css']
})
export class InvoiceLayoutComponent {
  readonly year = new Date().getFullYear();
}
