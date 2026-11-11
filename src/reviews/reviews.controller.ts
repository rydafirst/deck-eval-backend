import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import type { SessionUser, SubStatus } from '../shared';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { WorkspaceService } from '../submissions/workspace.service';
import { ReviewsService, type CommentInput } from './reviews.service';

const commentSchema = z.object({
  fieldId: z.string(),
  responseId: z.string().nullable(),
  body: z.string().trim().min(1).max(5000),
  suggestedValue: z.unknown().optional(),
});
const verdictSchema = z.object({ verdict: z.enum(['APPROVED', 'RETURNED']), summary: z.string().max(5000).optional() });

@Roles('REVIEWER', 'ADMIN')
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly workspace: WorkspaceService,
  ) {}

  @Get()
  queue(
    @Query('status') status?: SubStatus,
    @Query('projectId') projectId?: string,
    @Query('tagId') tagId?: string,
    @Query('raterId') raterId?: string,
  ) {
    return this.reviews.queue({ status, projectId, tagId, raterId });
  }

  @Get(':submissionId')
  get(@Param('submissionId') submissionId: string) {
    return this.workspace.forReviewer(submissionId);
  }

  @Post(':submissionId/comments')
  comment(
    @CurrentUser() user: SessionUser,
    @Param('submissionId') submissionId: string,
    @Body(new ZodPipe(commentSchema)) body: CommentInput,
  ) {
    return this.reviews.addComment(user, submissionId, body);
  }

  @Delete('comments/:commentId')
  @HttpCode(204)
  deleteComment(@CurrentUser() user: SessionUser, @Param('commentId') commentId: string) {
    return this.reviews.deleteComment(user, commentId);
  }

  @Post(':submissionId/verdict')
  @HttpCode(200)
  verdict(
    @CurrentUser() user: SessionUser,
    @Param('submissionId') submissionId: string,
    @Body(new ZodPipe(verdictSchema)) body: z.infer<typeof verdictSchema>,
  ) {
    return this.reviews.decide(user, submissionId, body.verdict, body.summary);
  }
}
