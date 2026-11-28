import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'dashboard',
    renderMode: RenderMode.Client,
  },
  {
    path: 'insights',
    renderMode: RenderMode.Client,
  },
  {
    path: 'peer-splits',
    renderMode: RenderMode.Client,
  },
  {
    path: 'peer-splits/new',
    renderMode: RenderMode.Client,
  },
  {
    path: 'peer-splits/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'expenses/new',
    renderMode: RenderMode.Client,
  },
  {
    path: 'expenses/:id/edit',
    renderMode: RenderMode.Client,
  },
  {
    path: 'history/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'history',
    renderMode: RenderMode.Client,
  },
  {
    path: 'profile',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
