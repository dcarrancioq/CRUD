import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private loadingMessageSubject = new BehaviorSubject<string>('');

  loading$: Observable<boolean> = this.loadingSubject.asObservable();
  loadingMessage$: Observable<string> = this.loadingMessageSubject.asObservable();

  show(message: string = ''): void {
    this.loadingMessageSubject.next(message);
    this.loadingSubject.next(true);
  }

  hide(): void {
    this.loadingSubject.next(false);
    this.loadingMessageSubject.next('');
  }

  setMessage(message: string): void {
    this.loadingMessageSubject.next(message);
  }
}
