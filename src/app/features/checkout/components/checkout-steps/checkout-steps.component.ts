import { Component, Input, Output, EventEmitter } from '@angular/core';

interface Step {
  number: number;
  title: string;
  icon: string;
}

@Component({
  selector: 'app-checkout-steps',
  templateUrl: './checkout-steps.component.html',
  styleUrls: ['./checkout-steps.component.css']
})
export class CheckoutStepsComponent {
  @Input() steps: Step[] = [];
  @Input() currentStep: number = 1;
  @Output() stepClick = new EventEmitter<number>();

  onStepClick(step: Step): void {
    if (step.number < this.currentStep) {
      this.stepClick.emit(step.number);
    }
  }

  isCompleted(step: Step): boolean {
    return step.number < this.currentStep;
  }

  isCurrent(step: Step): boolean {
    return step.number === this.currentStep;
  }

  isClickable(step: Step): boolean {
    return step.number < this.currentStep;
  }
}
