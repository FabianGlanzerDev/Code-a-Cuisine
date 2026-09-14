import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QuotaService } from './quota.service';

describe('Quota request reuse', /** Tests request cost and cache expiry. */ () => {
  it('shares in-flight reads and caches a short-lived snapshot', /** Avoids duplicate n8n executions. */ () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(QuotaService);
    const http = TestBed.inject(HttpTestingController);
    service.load().subscribe(); service.load().subscribe();
    http.expectOne(/** Matches quota reads. @param request HTTP request. */ request => request.method === 'GET')
      .flush({ ipLimit: 3, ipUsed: 0, ipRemaining: 3, systemLimit: 12, systemUsed: 12, systemRemaining: 0 });
    service.load().subscribe();
    http.expectNone(/** Matches redundant reads. @param request HTTP request. */ request => request.method === 'GET');
    expect(service.status?.systemRemaining).toBe(0);
    http.verify();
  });
});

describe('Invalid quota response recovery', /** Keeps absent responses distinguishable from free slots. */ () => {
  it('rejects a null response and permits a new read', /** An HTTP 200 null must expose the retry path. */ () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(QuotaService);
    const http = TestBed.inject(HttpTestingController);
    let failed = false;
    service.load().subscribe({ error: /** Records the unavailable status. */ () => failed = true });
    http.expectOne(/** Matches the status request. @param request HTTP request. */ request => request.method === 'GET').flush(null);
    expect(failed).toBeTrue(); expect(service.status).toBeNull();
    service.load().subscribe();
    http.expectOne(/** Matches the recovery request. @param request HTTP request. */ request => request.method === 'GET').flush({ ipLimit: 3, ipUsed: 0, ipRemaining: 3, systemLimit: 12, systemUsed: 0, systemRemaining: 12 });
    expect(service.status!.ipRemaining).toBe(3); http.verify();
  });
});
