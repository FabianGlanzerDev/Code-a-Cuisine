import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';

@Component({
  selector: 'app-welcome-page',
  imports: [RouterLink, SiteHeaderComponent],
  templateUrl: './welcome.page.html',
  styleUrl: './welcome.page.css',
})
export class WelcomePage { }
