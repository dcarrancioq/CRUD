import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService } from '../../../../core/services/admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Coupon } from '../../../../core/models/coupon.model';

@Component({
  selector: 'app-coupon-management',
  templateUrl: './coupon-management.component.html',
  styleUrls: ['./coupon-management.component.css']
})
export class CouponManagementComponent implements OnInit {
  coupons: Coupon[] = [];
  loading = true;
  
  showForm = false;
  isEditMode = false;
  editingCouponId?: string;
  form!: FormGroup;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadCoupons();
  }

  initForm(): void {
    this.form = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
      description: ['', Validators.required],
      discountType: ['percentage', Validators.required],
      discountValue: [10, [Validators.required, Validators.min(0)]],
      minimumPurchase: [0],
      maximumDiscount: [null],
      usageLimit: [null],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      isActive: [true]
    });
  }

  loadCoupons(): void {
    this.loading = true;
    this.adminService.getCoupons().subscribe({
      next: (response) => {
        this.coupons = response.data;
        this.loading = false;
      },
      error: () => {
        this.notificationService.error('Error al cargar cupones');
        this.loading = false;
      }
    });
  }

  openCreateForm(): void {
    this.isEditMode = false;
    this.editingCouponId = undefined;
    this.form.reset({
      discountType: 'percentage',
      discountValue: 10,
      minimumPurchase: 0,
      isActive: true
    });
    this.showForm = true;
  }

  editCoupon(coupon: Coupon): void {
    this.isEditMode = true;
    this.editingCouponId = coupon.id;
    this.form.patchValue({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumPurchase: coupon.minimumPurchase,
      maximumDiscount: coupon.maximumDiscount,
      usageLimit: coupon.usageLimit,
      startDate: this.formatDate(coupon.startDate || coupon.validFrom),
      endDate: this.formatDate(coupon.endDate || coupon.validUntil),
      isActive: coupon.isActive
    });
    this.showForm = true;
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  closeForm(): void {
    this.showForm = false;
    this.form.reset();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsTouched();
      });
      return;
    }

    this.saving = true;
    const couponData = this.form.value;
    couponData.code = couponData.code.toUpperCase();

    const request = this.isEditMode
      ? this.adminService.updateCoupon(this.editingCouponId!, couponData)
      : this.adminService.createCoupon(couponData);

    request.subscribe({
      next: () => {
        this.notificationService.success(
          this.isEditMode ? 'Cupon actualizado' : 'Cupon creado'
        );
        this.closeForm();
        this.loadCoupons();
        this.saving = false;
      },
      error: () => {
        this.notificationService.error('Error al guardar el cupon');
        this.saving = false;
      }
    });
  }

  toggleStatus(coupon: Coupon): void {
    this.adminService.toggleCouponStatus(coupon.id, !coupon.isActive).subscribe({
      next: () => {
        coupon.isActive = !coupon.isActive;
        this.notificationService.success(
          coupon.isActive ? 'Cupon activado' : 'Cupon desactivado'
        );
      },
      error: () => {
        this.notificationService.error('Error al cambiar estado');
      }
    });
  }

  deleteCoupon(coupon: Coupon): void {
    if (confirm(`¿Estas seguro de eliminar el cupon "${coupon.code}"?`)) {
      this.adminService.deleteCoupon(coupon.id).subscribe({
        next: () => {
          this.notificationService.success('Cupon eliminado');
          this.loadCoupons();
        },
        error: () => {
          this.notificationService.error('Error al eliminar cupon');
        }
      });
    }
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control ? control.invalid && control.touched : false;
  }

  isExpired(coupon: Coupon): boolean {
    const endDate = coupon.endDate || coupon.validUntil;
    return new Date(endDate) < new Date();
  }
}
