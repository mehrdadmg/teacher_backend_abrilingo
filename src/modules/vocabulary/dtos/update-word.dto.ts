import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Gender, Level, PartOfSpeech } from '../entities/word.entity';

export class UpdateWordDto {
  @IsOptional()
  @IsString()
  word?: string;

  @IsOptional()
  @IsEnum(PartOfSpeech)
  partOfSpeech?: PartOfSpeech;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;

  @IsOptional()
  @IsString()
  plural?: string | null;

  @IsOptional()
  @IsEnum(Level)
  level?: Level;

  // ── Inline translations (pass null to clear a language) ────────────────────

  @IsOptional()
  @IsString()
  translationFa?: string | null;

  @IsOptional()
  @IsString()
  translationEn?: string | null;

  @IsOptional()
  @IsString()
  translationRu?: string | null;

  @IsOptional()
  @IsString()
  translationAr?: string | null;

  /** Audio URL. Pass null to clear; audioCreatedAt is managed automatically. */
  @IsOptional()
  @IsString()
  audioFileUrl?: string | null;
}
