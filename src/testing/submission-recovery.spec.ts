import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RecipeDetailPage } from '../app/pages/recipe-detail/recipe-detail.page';
import { RecipeApiService } from '../app/services/recipe-api.service';
import { RecipeStoreService } from '../app/services/recipe-store.service';
import { QuotaService } from '../app/services/quota.service';

/** Opens a direct detail URL with its origin. */
function returnsToPage(): void {
    const route = { snapshot: { paramMap: convertToParamMap({ id: 'test' }), queryParamMap: convertToParamMap({ from: 'cookbook', cuisine: 'german', page: '3' }) } } as ActivatedRoute;
    const page = new RecipeDetailPage(route, TestBed.inject(RecipeApiService), new RecipeStoreService());
    page.ngOnInit();
    TestBed.inject(HttpTestingController).expectOne(/** Matches the detail read. */ r => r.url.includes('/test.json')).flush(null);
    expect(page.backRoute).toBe('/recipes-list');
    expect(page.backQuery).toEqual({ cuisine: 'german', page: 3 });
}



/** Advances local quota timers. */
function quotaTimeout(): void {
    const quota = TestBed.inject(QuotaService), http = TestBed.inject(HttpTestingController);
    let failed = false;
    quota.load().subscribe({ error: /** Records the timeout. */ () => failed = true });
    const first = http.expectOne(/** Captures quota read. */ () => true);
    tick(15000); expect(failed).toBeTrue(); expect(first.cancelled).toBeTrue();
    quota.load().subscribe();
    http.expectOne(/** Requires an explicit fresh read. */ () => true).flush({ ipLimit: 3, ipUsed: 0, ipRemaining: 3, systemLimit: 12, systemUsed: 0, systemRemaining: 12 });
    http.verify();
}



/** Advances local storage-read timers. */
function storageTimeout(): void {
    const http = TestBed.inject(HttpTestingController); let failed = false;
    TestBed.inject(RecipeApiService).getById('test').subscribe({ error: /** Records bounded failure. */ () => failed = true });
    const request = http.expectOne(/** Captures read only. */ r => r.method === 'GET');
    tick(15000); expect(request.cancelled).toBeTrue(); expect(failed).toBeTrue(); http.verify();
}



describe('Submission recovery checks', /** Registers isolated checks. */ () => {
  beforeEach(/** Installs isolated HTTP. */ () => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
  it('returns to the original category page independently of remembered pagination', returnsToPage);
  it('releases a stalled shared quota request so an explicit later check can run', fakeAsync(quotaTimeout));
  it('ends a stalled saved-recipe confirmation without writing', fakeAsync(storageTimeout));
});
