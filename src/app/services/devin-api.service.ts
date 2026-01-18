import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const baseUrl = 'https://api.devin.ai/v2/enterprise/consumption';

export interface ConsumptionCycle {
  start: string;
  end: string;
}

export interface DailyConsumptionResponse {
  consumption_by_date: Record<string, number>;
  consumption_by_org_id: Record<string, number>;
  total_acus: number;
  consumption_by_user?: Record<string, number>;
}

export interface UserDailyConsumptionResponse {
  consumption_by_date: Record<string, number>;
  consumption_by_org_id: Record<string, number>;
  total_acus: number;
}

@Injectable({
  providedIn: 'root',
})
export class DevinApiService {
  constructor(private http: HttpClient) {}

  private getHeaders(apiKey: string): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    });
  }

  getConsumptionCycles(apiKey: string): Observable<ConsumptionCycle[]> {
    return this.http.get<ConsumptionCycle[]>(`${baseUrl}/cycles`, {
      headers: this.getHeaders(apiKey)
    });
  }

  getDailyConsumption(
    apiKey: string,
    startDate?: string,
    endDate?: string,
    orgIds?: string
  ): Observable<DailyConsumptionResponse> {
    let params = new HttpParams();
    if (startDate) {
      params = params.set('start_date', startDate);
    }
    if (endDate) {
      params = params.set('end_date', endDate);
    }
    if (orgIds) {
      const orgIdArray = orgIds.split(',').map(id => id.trim());
      orgIdArray.forEach(id => {
        params = params.append('org_ids', id);
      });
    }

    return this.http.get<DailyConsumptionResponse>(`${baseUrl}/daily`, {
      headers: this.getHeaders(apiKey),
      params
    });
  }

  getUserDailyConsumption(
    apiKey: string,
    userId: string,
    startDate?: string,
    endDate?: string,
    orgIds?: string
  ): Observable<UserDailyConsumptionResponse> {
    let params = new HttpParams();
    if (startDate) {
      params = params.set('start_date', startDate);
    }
    if (endDate) {
      params = params.set('end_date', endDate);
    }
    if (orgIds) {
      const orgIdArray = orgIds.split(',').map(id => id.trim());
      orgIdArray.forEach(id => {
        params = params.append('org_ids', id);
      });
    }

    return this.http.get<UserDailyConsumptionResponse>(`${baseUrl}/daily/${userId}`, {
      headers: this.getHeaders(apiKey),
      params
    });
  }
}
