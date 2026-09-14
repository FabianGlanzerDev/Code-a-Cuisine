import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { finalize, Observable, of, shareReplay, tap, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { QuotaStatus } from '../models/recipe.model';

@Injectable({ providedIn: 'root' })
export class QuotaService {
  status: QuotaStatus | null = null;
  private pending?: Observable<QuotaStatus>;
  private checkedAt = 0;

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
    const now = Date.now();
    if (this.status && now - this.checkedAt < 60000
      && new Date(now).getUTCDate() === new Date(this.checkedAt).getUTCDate()) return of(this.status);
    if (!this.pending) this.invalidate();
    return this.pending ??= this.http.get<QuotaStatus>(environment.quotaStatusUrl).pipe(
      timeout(15000),
      tap(/** Caches the returned status. @param status Quota snapshot. */ status => this.set(status)),
      finalize(/** Releases the shared request. */ () => this.pending = undefined),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }



  /**
   * Stores a quota snapshot returned by n8n.
   * @param status Quota snapshot.
   */
  set(status: QuotaStatus | undefined): void {
    if (!status) return;
    if (!this.validStatus(status)) { this.invalidate(); throw new Error('Invalid quota status'); }
    this.status = status;
    this.checkedAt = Date.now();
  }



  /** Rejects malformed or inconsistent availability snapshots. @param status Server snapshot. */
  private validStatus(status: QuotaStatus): boolean {
    return status.ipLimit === 3 && status.systemLimit === 12
      && [status.ipUsed, status.ipRemaining, status.systemUsed, status.systemRemaining].every(/** Checks counts. @param count Slot count. */ count => Number.isInteger(count) && count >= 0)
      && status.ipUsed + status.ipRemaining === 3 && status.systemUsed + status.systemRemaining === 12;
  }



  /** Invalidates a snapshot after an ambiguous gateway failure or external quota change. */
  invalidate(): void {
    this.status = null;
    this.checkedAt = 0;
  }
}
