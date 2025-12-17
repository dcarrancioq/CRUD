import { Component, OnInit } from '@angular/core';
import * as Sentry from '@sentry/angular';
import { Tutorial } from '../../models/tutorial.model';
import { TutorialService } from '../../services/tutorial.service';

@Component({
  selector: 'app-tutorials-list',
  templateUrl: './tutorials-list.component.html',
  styleUrls: ['./tutorials-list.component.css'],
})
export class TutorialsListComponent implements OnInit {
  tutorials?: Tutorial[];
  currentTutorial: Tutorial = {};
  currentIndex = -1;
  title = '';

  constructor(private tutorialService: TutorialService) {}

  ngOnInit(): void {
    Sentry.addBreadcrumb({
      category: 'navigation',
      message: 'TutorialsListComponent initialized',
      level: 'info',
    });
    this.retrieveTutorials();
  }

  retrieveTutorials(): void {
    this.tutorialService.getAll().subscribe({
      next: (data) => {
        this.tutorials = data;
        console.log(data);
      },
      error: (e) => {
        Sentry.captureException(e, {
          tags: { component: 'TutorialsListComponent', action: 'retrieveTutorials' },
        });
        console.error(e);
      }
    });
  }

  refreshList(): void {
    this.retrieveTutorials();
    this.currentTutorial = {};
    this.currentIndex = -1;
  }

  setActiveTutorial(tutorial: Tutorial, index: number): void {
    this.currentTutorial = tutorial;
    this.currentIndex = index;
  }

  removeAllTutorials(): void {
    this.tutorialService.deleteAll().subscribe({
      next: (res) => {
        console.log(res);
        this.refreshList();
      },
      error: (e) => {
        Sentry.captureException(e, {
          tags: { component: 'TutorialsListComponent', action: 'removeAllTutorials' },
        });
        console.error(e);
      }
    });
  }

  searchTitle(): void {
    this.currentTutorial = {};
    this.currentIndex = -1;

    this.tutorialService.findByTitle(this.title).subscribe({
      next: (data) => {
        this.tutorials = data;
        console.log(data);
      },
      error: (e) => {
        Sentry.captureException(e, {
          tags: { component: 'TutorialsListComponent', action: 'searchTitle' },
        });
        console.error(e);
      }
    });
  }
}
