import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-rating-stars',
  templateUrl: './rating-stars.component.html',
  styleUrls: ['./rating-stars.component.css']
})
export class RatingStarsComponent {
  @Input() rating: number = 0;
  @Input() maxRating: number = 5;
  @Input() readonly: boolean = true;
  @Input() showValue: boolean = true;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Output() ratingChange = new EventEmitter<number>();

  hoverRating: number = 0;

  get stars(): number[] {
    return Array(this.maxRating).fill(0).map((_, i) => i + 1);
  }

  getStarClass(star: number): string {
    const currentRating = this.hoverRating || this.rating;
    if (star <= currentRating) {
      return 'star filled';
    } else if (star - 0.5 <= currentRating) {
      return 'star half-filled';
    }
    return 'star empty';
  }

  onStarClick(star: number): void {
    if (!this.readonly) {
      this.rating = star;
      this.ratingChange.emit(star);
    }
  }

  onStarHover(star: number): void {
    if (!this.readonly) {
      this.hoverRating = star;
    }
  }

  onStarLeave(): void {
    this.hoverRating = 0;
  }
}
