import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CheckoutService } from '../../../../core/services/checkout.service';
import { CartService } from '../../../../core/services/cart.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Cart } from '../../../../core/models/cart.model';
import { CheckoutData } from '../../../../core/models/order.model';

@Component({
  selector: 'app-checkout-page',
  templateUrl: './checkout-page.component.html',
  styleUrls: ['./checkout-page.component.css']
})
export class CheckoutPageComponent implements OnInit, OnDestroy {
  cart: Cart | null = null;
  checkoutData: CheckoutData | null = null;
  currentStep: number = 1;
  loading = false;
  placing = false;

  steps = [
    { number: 1, title: 'Datos personales', icon: 'person' },
    { number: 2, title: 'Envio', icon: 'truck' },
    { number: 3, title: 'Pago', icon: 'credit-card' },
    { number: 4, title: 'Confirmar', icon: 'check-circle' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private checkoutService: CheckoutService,
    private cartService: CartService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cartService.cart$.pipe(takeUntil(this.destroy$)).subscribe(cart => {
      this.cart = cart;
      if (!cart || cart.items.length === 0) {
        this.router.navigate(['/cart']);
      }
    });

    this.checkoutService.checkoutData$.pipe(takeUntil(this.destroy$)).subscribe(data => {
      this.checkoutData = data;
    });

    this.checkoutService.currentStep$.pipe(takeUntil(this.destroy$)).subscribe(step => {
      this.currentStep = step;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onStepChange(step: number): void {
    if (step < this.currentStep) {
      this.checkoutService.goToStep(step);
    }
  }

  onCustomerInfoSubmit(data: { firstName: string; lastName: string; email: string; phone: string }): void {
    this.checkoutService.setCustomerInfo(data);
    this.checkoutService.nextStep();
  }

  onShippingSubmit(data: { address: any; method: any }): void {
    this.checkoutService.setShippingAddress(data.address);
    this.checkoutService.setShippingMethod(data.method);
    this.checkoutService.nextStep();
  }

  onPaymentSubmit(data: { method: string; details: any }): void {
    this.checkoutService.setPaymentMethod(data.method, data.details);
    this.checkoutService.nextStep();
  }

  onPlaceOrder(): void {
    this.placing = true;
    this.checkoutService.placeOrder().subscribe({
      next: (order) => {
        this.placing = false;
        this.notificationService.success('Pedido realizado con exito');
        this.router.navigate(['/orders/confirmation', order.orderNumber]);
      },
      error: (err) => {
        this.placing = false;
        this.notificationService.error(err.message || 'Error al procesar el pedido');
      }
    });
  }

  goBack(): void {
    this.checkoutService.previousStep();
  }
}
