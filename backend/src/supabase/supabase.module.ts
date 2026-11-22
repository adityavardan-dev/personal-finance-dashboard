/** Provides the shared Supabase Auth and Data API client for the Nest backend. */
import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Global()
@Module({ providers: [SupabaseService], exports: [SupabaseService] })
export class SupabaseModule {}
