import { Component, Input, OnInit } from '@angular/core';
import { ProductService } from '../../../../core/services/product.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Review, PaginatedResponse } from '../../../../core/models/product.model';

@Component({
  selector: 'app-product-reviews',
  templateUrl: './product-reviews.component.html',
  styleUrls: ['./product-reviews.component.css']
})
export class ProductReviewsComponent implements OnInit {
  @Input() productId!: string;

  reviews: Review[] = [];
  loading = false;
  submitting = false;
  
  currentPage = 1;
  totalPages = 1;
  totalReviews = 0;

  showReviewForm = false;
  newReview = {
    rating: 5,
    title: '',
    comment: ''
  };

  constructor(
    private productService: ProductService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadReviews();
  }

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated;
  }

  loadReviews(): void {
    this.loading = true;
    this.productService.getProductReviews(this.productId, this.currentPage).subscribe({
      next: (response: PaginatedResponse<Review>) => {
        this.reviews = response.data;
        this.totalPages = response.totalPages;
        this.totalReviews = response.total;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadReviews();
  }

  toggleReviewForm(): void {
    if (!this.isAuthenticated) {
      this.notificationService.warning('Debes iniciar sesion para dejar una opinion');
      return;
    }
    this.showReviewForm = !this.showReviewForm;
  }

  onRatingChange(rating: number): void {
    this.newReview.rating = rating;
  }

  submitReview(): void {
    if (!this.newReview.title || !this.newReview.comment) {
      this.notificationService.warning('Por favor completa todos los campos');
      return;
    }

    this.submitting = true;
    this.productService.submitReview(this.productId, this.newReview).subscribe({
      next: (review) => {
        this.reviews.unshift(review);
        this.totalReviews++;
        this.showReviewForm = false;
        this.newReview = { rating: 5, title: '', comment: '' };
        this.submitting = false;
        this.notificationService.success('Gracias por tu opinion');
      },
      error: () => {
        this.submitting = false;
        this.notificationService.error('Error al enviar la opinion');
      }
    });
  }

  cancelReview(): void {
    this.showReviewForm = false;
    this.newReview = { rating: 5, title: '', comment: '' };
  }
}
