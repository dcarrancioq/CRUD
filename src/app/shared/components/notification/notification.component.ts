import { Component, OnInit } from '@angular/core';
import { NotificationService, Notification } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.css']
})
export class NotificationComponent implements OnInit {
  notifications: Notification[] = [];

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.notificationService.notifications$.subscribe(
      notifications => this.notifications = notifications
    );
  }

  dismiss(id: string): void {
    this.notificationService.dismiss(id);
  }

  getIcon(type: string): string {
    switch (type) {
      case 'success': return 'check-circle';
      case 'error': return 'x-circle';
      case 'warning': return 'alert-triangle';
      case 'info': return 'info';
      default: return 'info';
    }
  }
}
