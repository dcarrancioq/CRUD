import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { 
  CheckoutData, 
  CustomerInfo, 
  Address, 
  ShippingMethod, 
  PaymentMethod,
  Order
} from '../models/order.model';
import { Cart } from '../models/cart.model';
import { CartService } from './cart.service';
import { environment } from '../../../environments/environment';

export interface CheckoutStep {
  id: string;
  title: string;
  completed: boolean;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CheckoutService {
  private readonly API_URL = `${environment.apiUrl}/checkout`;
  
  private checkoutDataSubject = new BehaviorSubject<Partial<CheckoutData>>({
    useSameAddressForBilling: true,
    acceptedTerms: false
  });
  
  private currentStepSubject = new BehaviorSubject<number>(0);
  
  checkoutData$ = this.checkoutDataSubject.asObservable();
  currentStep$ = this.currentStepSubject.asObservable();

  readonly steps: CheckoutStep[] = [
    { id: 'customer', title: 'Datos Personales', completed: false, active: true },
    { id: 'shipping', title: 'Envio', completed: false, active: false },
    { id: 'payment', title: 'Pago', completed: false, active: false },
    { id: 'review', title: 'Confirmacion', completed: false, active: false }
  ];

  constructor(
    private http: HttpClient,
    private cartService: CartService
  ) {}

  get checkoutData(): Partial<CheckoutData> {
    return this.checkoutDataSubject.value;
  }

  get currentStep(): number {
    return this.currentStepSubject.value;
  }

  setCustomerInfo(customer: CustomerInfo): void {
    const current = this.checkoutDataSubject.value;
    this.checkoutDataSubject.next({ ...current, customer });
    this.markStepCompleted(0);
  }

  setShippingAddress(address: Address): void {
    const current = this.checkoutDataSubject.value;
    this.checkoutDataSubject.next({ ...current, shippingAddress: address });
    
    if (current.useSameAddressForBilling) {
      this.checkoutDataSubject.next({ 
        ...this.checkoutDataSubject.value, 
        billingAddress: address 
      });
    }
  }

  setBillingAddress(address: Address): void {
    const current = this.checkoutDataSubject.value;
    this.checkoutDataSubject.next({ ...current, billingAddress: address });
  }

  setUseSameAddressForBilling(useSame: boolean): void {
    const current = this.checkoutDataSubject.value;
    this.checkoutDataSubject.next({ ...current, useSameAddressForBilling: useSame });
    
    if (useSame && current.shippingAddress) {
      this.checkoutDataSubject.next({ 
        ...this.checkoutDataSubject.value, 
        billingAddress: current.shippingAddress 
      });
    }
  }

  setShippingMethod(method: ShippingMethod): void {
    const current = this.checkoutDataSubject.value;
    this.checkoutDataSubject.next({ ...current, shippingMethod: method });
    this.markStepCompleted(1);
  }

  setPaymentMethod(method: PaymentMethod): void {
    const current = this.checkoutDataSubject.value;
    this.checkoutDataSubject.next({ ...current, paymentMethod: method });
    this.markStepCompleted(2);
  }

  setNotes(notes: string): void {
    const current = this.checkoutDataSubject.value;
    this.checkoutDataSubject.next({ ...current, notes });
  }

  setAcceptedTerms(accepted: boolean): void {
    const current = this.checkoutDataSubject.value;
    this.checkoutDataSubject.next({ ...current, acceptedTerms: accepted });
  }

  nextStep(): void {
    const current = this.currentStepSubject.value;
    if (current < this.steps.length - 1) {
      this.currentStepSubject.next(current + 1);
      this.updateStepsState();
    }
  }

  previousStep(): void {
    const current = this.currentStepSubject.value;
    if (current > 0) {
      this.currentStepSubject.next(current - 1);
      this.updateStepsState();
    }
  }

  goToStep(stepIndex: number): void {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      const canNavigate = stepIndex === 0 || this.steps[stepIndex - 1].completed;
      if (canNavigate) {
        this.currentStepSubject.next(stepIndex);
        this.updateStepsState();
      }
    }
  }

  private markStepCompleted(stepIndex: number): void {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      this.steps[stepIndex].completed = true;
    }
  }

  private updateStepsState(): void {
    const currentStep = this.currentStepSubject.value;
    this.steps.forEach((step, index) => {
      step.active = index === currentStep;
    });
  }

  validateStep(stepIndex: number): { valid: boolean; errors: string[] } {
    const data = this.checkoutDataSubject.value;
    const errors: string[] = [];

    switch (stepIndex) {
      case 0: // Customer Info
        if (!data.customer?.firstName) errors.push('El nombre es requerido');
        if (!data.customer?.lastName) errors.push('El apellido es requerido');
        if (!data.customer?.email) errors.push('El email es requerido');
        if (!data.customer?.phone) errors.push('El telefono es requerido');
        break;
      case 1: // Shipping
        if (!data.shippingAddress?.addressLine1) errors.push('La direccion es requerida');
        if (!data.shippingAddress?.city) errors.push('La ciudad es requerida');
        if (!data.shippingAddress?.postalCode) errors.push('El codigo postal es requerido');
        if (!data.shippingAddress?.country) errors.push('El pais es requerido');
        if (!data.shippingMethod) errors.push('Seleccione un metodo de envio');
        break;
      case 2: // Payment
        if (!data.paymentMethod) errors.push('Seleccione un metodo de pago');
        break;
      case 3: // Review
        if (!data.acceptedTerms) errors.push('Debe aceptar los terminos y condiciones');
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  getShippingMethods(address: { country: string; postalCode: string }): Observable<ShippingMethod[]> {
    return this.http.post<ShippingMethod[]>(`${this.API_URL}/shipping-methods`, address);
  }

  calculateTotals(): Observable<{ subtotal: number; shipping: number; tax: number; discount: number; total: number }> {
    const data = this.checkoutDataSubject.value;
    return this.http.post<{ subtotal: number; shipping: number; tax: number; discount: number; total: number }>(
      `${this.API_URL}/calculate`,
      { shippingMethodId: data.shippingMethod?.id }
    );
  }

  processPayment(paymentDetails: any): Observable<{ success: boolean; transactionId?: string; error?: string }> {
    return this.http.post<{ success: boolean; transactionId?: string; error?: string }>(
      `${environment.apiUrl}/payments/process`,
      paymentDetails
    );
  }

  placeOrder(): Observable<Order> {
    const checkoutData = this.checkoutDataSubject.value as CheckoutData;
    return this.http.post<Order>(`${this.API_URL}/place-order`, checkoutData).pipe(
      tap(() => {
        this.cartService.clearCart().subscribe();
        this.resetCheckout();
      })
    );
  }

  resetCheckout(): void {
    this.checkoutDataSubject.next({
      useSameAddressForBilling: true,
      acceptedTerms: false
    });
    this.currentStepSubject.next(0);
    this.steps.forEach(step => {
      step.completed = false;
      step.active = false;
    });
    this.steps[0].active = true;
  }

  saveCheckoutProgress(): void {
    const data = this.checkoutDataSubject.value;
    sessionStorage.setItem('checkout_progress', JSON.stringify({
      data,
      step: this.currentStepSubject.value
    }));
  }

  restoreCheckoutProgress(): boolean {
    const saved = sessionStorage.getItem('checkout_progress');
    if (saved) {
      const { data, step } = JSON.parse(saved);
      this.checkoutDataSubject.next(data);
      this.currentStepSubject.next(step);
      this.updateStepsState();
      return true;
    }
    return false;
  }

  clearCheckoutProgress(): void {
    sessionStorage.removeItem('checkout_progress');
  }
}
