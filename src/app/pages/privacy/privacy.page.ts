import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';

@Component({
  selector: 'app-privacy-page',
  imports: [RouterLink, SiteHeaderComponent],
  templateUrl: './privacy.page.html',
  styleUrl: './privacy.page.css',
})
export class PrivacyPage {}
