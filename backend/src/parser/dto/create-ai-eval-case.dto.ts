/** User-approved DEV example of what a Penny conversation turn should do. */
import { IsBoolean, IsObject, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateAiEvalCaseDto {
  @IsUUID()
  conversationId!: string;

  @IsUUID()
  requestId!: string;

  @IsUUID()
  responseId!: string;

  @IsObject()
  input!: Record<string, unknown>;

  @IsObject()
  observed!: Record<string, unknown>;

  @IsBoolean()
  modelAttempted!: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  expectedDescription!: string;
}
