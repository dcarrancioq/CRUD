import { Component } from '@angular/core';
import { DevinApiService } from '../../services/devin-api.service';

interface EndpointConfig {
  id: string;
  name: string;
  description: string;
  requiresUserId: boolean;
  hasDateParams: boolean;
  hasOrgIds: boolean;
}

@Component({
  selector: 'app-api-consumer',
  templateUrl: './api-consumer.component.html',
  styleUrls: ['./api-consumer.component.css'],
})
export class ApiConsumerComponent {
  endpoints: EndpointConfig[] = [
    {
      id: 'consumption-cycles',
      name: 'Consumption Cycles',
      description: 'Generate a list of all billing cycles for the enterprise',
      requiresUserId: false,
      hasDateParams: false,
      hasOrgIds: false
    },
    {
      id: 'daily-consumption',
      name: 'Daily Consumption',
      description: 'Return daily consumption for the current billing cycle',
      requiresUserId: false,
      hasDateParams: true,
      hasOrgIds: true
    },
    {
      id: 'user-daily-consumption',
      name: 'User Daily Consumption',
      description: 'Return daily consumption for a specific user',
      requiresUserId: true,
      hasDateParams: true,
      hasOrgIds: true
    }
  ];

  selectedEndpoint: EndpointConfig | null = null;
  apiKey = '';
  userId = '';
  startDate = '';
  endDate = '';
  orgIds = '';

  loading = false;
  error = '';
  response: string | null = null;

  constructor(private devinApiService: DevinApiService) {}

  onEndpointChange(): void {
    this.response = null;
    this.error = '';
    this.userId = '';
    this.startDate = '';
    this.endDate = '';
    this.orgIds = '';
  }

  executeApi(): void {
    if (!this.apiKey) {
      this.error = 'API Key is required';
      return;
    }

    if (!this.selectedEndpoint) {
      this.error = 'Please select an endpoint';
      return;
    }

    if (this.selectedEndpoint.requiresUserId && !this.userId) {
      this.error = 'User ID is required for this endpoint';
      return;
    }

    this.loading = true;
    this.error = '';
    this.response = null;

    switch (this.selectedEndpoint.id) {
      case 'consumption-cycles':
        this.devinApiService.getConsumptionCycles(this.apiKey).subscribe({
          next: (res) => {
            this.response = JSON.stringify(res, null, 2);
            this.loading = false;
          },
          error: (e) => {
            this.handleError(e);
          }
        });
        break;

      case 'daily-consumption':
        this.devinApiService.getDailyConsumption(
          this.apiKey,
          this.startDate || undefined,
          this.endDate || undefined,
          this.orgIds || undefined
        ).subscribe({
          next: (res) => {
            this.response = JSON.stringify(res, null, 2);
            this.loading = false;
          },
          error: (e) => {
            this.handleError(e);
          }
        });
        break;

      case 'user-daily-consumption':
        this.devinApiService.getUserDailyConsumption(
          this.apiKey,
          this.userId,
          this.startDate || undefined,
          this.endDate || undefined,
          this.orgIds || undefined
        ).subscribe({
          next: (res) => {
            this.response = JSON.stringify(res, null, 2);
            this.loading = false;
          },
          error: (e) => {
            this.handleError(e);
          }
        });
        break;
    }
  }

  private handleError(error: { status?: number; message?: string; error?: { detail?: string } }): void {
    this.loading = false;
    if (error.status === 401) {
      this.error = 'Unauthorized: Invalid API Key';
    } else if (error.status === 403) {
      this.error = 'Forbidden: Insufficient permissions. Enterprise Admin API Key required.';
    } else if (error.status === 404) {
      this.error = 'Not Found: The requested resource was not found';
    } else if (error.error && error.error.detail) {
      this.error = `Error: ${error.error.detail}`;
    } else {
      this.error = `Error: ${error.message || 'An unexpected error occurred'}`;
    }
  }

  clearResponse(): void {
    this.response = null;
    this.error = '';
  }
}
