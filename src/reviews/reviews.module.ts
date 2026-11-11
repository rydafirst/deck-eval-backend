import { Module } from '@nestjs/common';
import { SubmissionsModule } from '../submissions/submissions.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({ imports: [SubmissionsModule], controllers: [ReviewsController], providers: [ReviewsService] })
export class ReviewsModule {}
