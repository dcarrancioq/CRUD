import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-sidebar',
  templateUrl: './admin-sidebar.component.html',
  styleUrls: ['./admin-sidebar.component.css']
})
export class AdminSidebarComponent {
  @Input() collapsed = false;

  menuItems = [
    { icon: 'speedometer2', label: 'Dashboard', route: '/admin' },
    { icon: 'box-seam', label: 'Productos', route: '/admin/products' },
    { icon: 'bag', label: 'Pedidos', route: '/admin/orders' },
    { icon: 'people', label: 'Clientes', route: '/admin/customers' },
    { icon: 'tag', label: 'Cupones', route: '/admin/coupons' }
  ];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  isActive(route: string): boolean {
    if (route === '/admin') {
      return this.router.url === '/admin';
    }
    return this.router.url.startsWith(route);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
