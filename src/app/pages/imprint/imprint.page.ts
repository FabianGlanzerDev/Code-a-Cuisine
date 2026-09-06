import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';

@Component({
  selector: 'app-imprint-page',
  imports: [RouterLink, SiteHeaderComponent],
  templateUrl: './imprint.page.html',
  styleUrl: './imprint.page.css',
})
export class ImprintPage { }
