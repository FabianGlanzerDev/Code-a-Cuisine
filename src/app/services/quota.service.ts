import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { QuotaStatus } from '../models/recipe.model';

@Injectable({ providedIn: 'root' })
export class QuotaService {
  status: QuotaStatus | null = null;

  /**
   * Initializes the component or service with its required dependencies.
   * @param http Injected HTTP client.
   */
  constructor(private readonly http: HttpClient) {}



  /**
   * Loads the current IP and system quota from n8n.
   * @returns {Observable<QuotaStatus>} The result of this operation.
   */
  load(): Observable<QuotaStatus> {
    return this.http.get<QuotaStatus>(environment.quotaStatusUrl);
  }



  /**
   * Stores a quota snapshot returned by n8n.
   * @param status Quota snapshot.
   */
  set(status: QuotaStatus | undefined): void {
    if (status) this.status = status;
  }
}
