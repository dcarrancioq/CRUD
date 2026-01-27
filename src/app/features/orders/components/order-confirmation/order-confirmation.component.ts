import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../../core/services/order.service';
import { Order } from '../../../../core/models/order.model';

@Component({
  selector: 'app-order-confirmation',
  templateUrl: './order-confirmation.component.html',
  styleUrls: ['./order-confirmation.component.css']
})
export class OrderConfirmationComponent implements OnInit {
  order?: Order;
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    const orderNumber = this.route.snapshot.params['orderNumber'];
    if (orderNumber) {
      this.loadOrder(orderNumber);
    } else {
      this.router.navigate(['/']);
    }
  }

  loadOrder(orderNumber: string): void {
    this.orderService.getOrderByNumber(orderNumber).subscribe({
      next: (order) => {
        this.order = order;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la informacion del pedido';
        this.loading = false;
      }
    });
  }

  goToOrders(): void {
    this.router.navigate(['/orders']);
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }
}
