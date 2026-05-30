import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateExampleDto {
  /** A natural German sentence containing the target word. */
  @IsString()
  @IsNotEmpty()
  sentence: string;

  /** Optional Persian (Farsi) translation. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  translationFa?: string;

  /** Optional English translation. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  translationEn?: string;

  /** Optional Russian translation. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  translationRu?: string;

  /** Optional Arabic translation. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  translationAr?: string;
}
