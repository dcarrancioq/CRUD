import { Component } from '@angular/core';
import * as Sentry from '@sentry/angular';
import { Tutorial } from '../../models/tutorial.model';
import { TutorialService } from '../../services/tutorial.service';

@Component({
  selector: 'app-add-tutorial',
  templateUrl: './add-tutorial.component.html',
  styleUrls: ['./add-tutorial.component.css'],
})
export class AddTutorialComponent {
  tutorial: Tutorial = {
    title: '',
    description: '',
    published: false
  };
  submitted = false;

  constructor(private tutorialService: TutorialService) {}

  saveTutorial(): void {
    Sentry.addBreadcrumb({
      category: 'user-action',
      message: 'User saving new tutorial',
      level: 'info',
      data: { title: this.tutorial.title },
    });

    const data = {
      title: this.tutorial.title,
      description: this.tutorial.description
    };

    this.tutorialService.create(data).subscribe({
      next: (res) => {
        console.log(res);
        this.submitted = true;
      },
      error: (e) => {
        Sentry.captureException(e, {
          tags: { component: 'AddTutorialComponent', action: 'saveTutorial' },
        });
        console.error(e);
      }
    });
  }

  newTutorial(): void {
    this.submitted = false;
    this.tutorial = {
      title: '',
      description: '',
      published: false
    };
  }
}
