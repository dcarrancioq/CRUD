import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { AdminService } from '../../../../core/services/admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Product, Category } from '../../../../core/models/product.model';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.css']
})
export class ProductFormComponent implements OnInit {
  form!: FormGroup;
  categories: Category[] = [];
  isEditMode = false;
  productId?: string;
  loading = false;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadCategories();

    this.productId = this.route.snapshot.params['id'];
    if (this.productId) {
      this.isEditMode = true;
      this.loadProduct(this.productId);
    }
  }

  initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      slug: ['', Validators.required],
      sku: ['', Validators.required],
      shortDescription: ['', [Validators.required, Validators.maxLength(200)]],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      compareAtPrice: [null],
      cost: [null],
      categoryId: ['', Validators.required],
      status: ['draft', Validators.required],
      stockQuantity: [0, [Validators.required, Validators.min(0)]],
      lowStockThreshold: [5],
      weight: [null],
      tags: [''],
      metaTitle: [''],
      metaDescription: [''],
      attributes: this.fb.array([])
    });

    this.form.get('name')?.valueChanges.subscribe(name => {
      if (!this.isEditMode || !this.form.get('slug')?.value) {
        const slug = this.generateSlug(name);
        this.form.get('slug')?.setValue(slug, { emitEvent: false });
      }
    });
  }

  get attributes(): FormArray {
    return this.form.get('attributes') as FormArray;
  }

  addAttribute(): void {
    this.attributes.push(this.fb.group({
      name: ['', Validators.required],
      value: ['', Validators.required]
    }));
  }

  removeAttribute(index: number): void {
    this.attributes.removeAt(index);
  }

  loadCategories(): void {
    this.adminService.getCategories().subscribe({
      next: (categories) => this.categories = categories
    });
  }

  loadProduct(id: string): void {
    this.loading = true;
    this.adminService.getProducts({ id }).subscribe({
      next: (response) => {
        if (response.data.length > 0) {
          this.populateForm(response.data[0]);
        }
        this.loading = false;
      },
      error: () => {
        this.notificationService.error('Error al cargar el producto');
        this.loading = false;
      }
    });
  }

  populateForm(product: Product): void {
    this.form.patchValue({
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      shortDescription: product.shortDescription,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      cost: product.cost,
      categoryId: product.category?.id,
      status: product.status,
      stockQuantity: product.stock?.quantity,
      lowStockThreshold: product.stock?.lowStockThreshold,
      weight: product.weight,
      tags: product.tags?.join(', '),
      metaTitle: product.seo?.metaTitle,
      metaDescription: product.seo?.metaDescription
    });

    if (product.attributes) {
      product.attributes.forEach(attr => {
        this.attributes.push(this.fb.group({
          name: [attr.name, Validators.required],
          value: [attr.value, Validators.required]
        }));
      });
    }
  }

  generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.saving = true;
    const formData = this.prepareFormData();

    const request = this.isEditMode
      ? this.adminService.updateProduct(this.productId!, formData)
      : this.adminService.createProduct(formData);

    request.subscribe({
      next: () => {
        this.notificationService.success(
          this.isEditMode ? 'Producto actualizado' : 'Producto creado'
        );
        this.router.navigate(['/admin/products']);
      },
      error: () => {
        this.notificationService.error('Error al guardar el producto');
        this.saving = false;
      }
    });
  }

  prepareFormData(): any {
    const values = this.form.value;
    return {
      name: values.name,
      slug: values.slug,
      sku: values.sku,
      shortDescription: values.shortDescription,
      description: values.description,
      price: values.price,
      compareAtPrice: values.compareAtPrice,
      cost: values.cost,
      categoryId: values.categoryId,
      status: values.status,
      stock: {
        quantity: values.stockQuantity,
        lowStockThreshold: values.lowStockThreshold
      },
      weight: values.weight,
      tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()) : [],
      seo: {
        metaTitle: values.metaTitle,
        metaDescription: values.metaDescription
      },
      attributes: values.attributes
    };
  }

  private markFormGroupTouched(): void {
    Object.keys(this.form.controls).forEach(key => {
      this.form.get(key)?.markAsTouched();
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control ? control.invalid && control.touched : false;
  }

  cancel(): void {
    this.router.navigate(['/admin/products']);
  }
}
