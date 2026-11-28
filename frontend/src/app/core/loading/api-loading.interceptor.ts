import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';
import { ApiLoadingStore } from './api-loading.store';

export const apiLoadingInterceptor: HttpInterceptorFn = (request, next) => {
  const loading = inject(ApiLoadingStore);
  loading.start();
  return next(request).pipe(finalize(() => loading.finish()));
};
