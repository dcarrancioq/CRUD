import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { CartService } from '../services/cart.service';

@Injectable({
  providedIn: 'root'
})
export class CheckoutGuard implements CanActivate {
  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.cartService.cart$.pipe(
      take(1),
      map(cart => {
        if (cart && cart.items.length > 0) {
          return true;
        }
        return this.router.createUrlTree(['/cart']);
      })
    );
  }
}
