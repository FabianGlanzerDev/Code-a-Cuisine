import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch(/** Handles a rejected asynchronous operation. @param error Current callback input. */ (error: unknown) => console.error(error));
