/**
 * Purpose: Handles peer-split request routing and split preview calculations.
 */
import { Module } from '@nestjs/common';
import { PeerSplitsController } from './peer-splits.controller';
import { PeerSplitsService } from './peer-splits.service';

@Module({ controllers: [PeerSplitsController], providers: [PeerSplitsService] })
export class PeerSplitsModule {}
