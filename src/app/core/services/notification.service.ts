import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  duration?: number;
  dismissible?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  notifications$: Observable<Notification[]> = this.notificationsSubject.asObservable();

  private defaultDuration = 5000;

  success(message: string, title?: string, duration?: number): void {
    this.show({ type: 'success', message, title, duration });
  }

  error(message: string, title?: string, duration?: number): void {
    this.show({ type: 'error', message, title, duration: duration || 8000 });
  }

  warning(message: string, title?: string, duration?: number): void {
    this.show({ type: 'warning', message, title, duration });
  }

  info(message: string, title?: string, duration?: number): void {
    this.show({ type: 'info', message, title, duration });
  }

  private show(notification: Omit<Notification, 'id' | 'dismissible'>): void {
    const id = this.generateId();
    const newNotification: Notification = {
      ...notification,
      id,
      dismissible: true,
      duration: notification.duration || this.defaultDuration
    };

    const current = this.notificationsSubject.value;
    this.notificationsSubject.next([...current, newNotification]);

    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => this.dismiss(id), newNotification.duration);
    }
  }

  dismiss(id: string): void {
    const current = this.notificationsSubject.value;
    this.notificationsSubject.next(current.filter(n => n.id !== id));
  }

  dismissAll(): void {
    this.notificationsSubject.next([]);
  }

  private generateId(): string {
    return 'notif_' + Math.random().toString(36).substr(2, 9);
  }
}
