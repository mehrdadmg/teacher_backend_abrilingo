import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { Gender, Level, PartOfSpeech } from '../entities/word.entity';

export class UpdateWordDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  word?: string;

  @IsOptional()
  @IsEnum(PartOfSpeech)
  partOfSpeech?: PartOfSpeech;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  plural?: string | null;

  @IsOptional()
  @IsEnum(Level)
  level?: Level;

  // ── Inline translations (pass null to clear a language) ────────────────────

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  translationFa?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  translationEn?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  translationRu?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  translationAr?: string | null;

  /** Audio URL. Pass null to clear; audioCreatedAt is managed automatically. */
  @IsOptional()
  @IsUrl()
  audioFileUrl?: string | null;
}
