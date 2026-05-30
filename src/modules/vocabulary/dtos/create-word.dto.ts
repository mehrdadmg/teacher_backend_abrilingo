import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Gender, Level, PartOfSpeech } from '../entities/word.entity';

export class CreateWordDto {
  @IsString()
  @IsNotEmpty()
  word: string;

  @IsEnum(PartOfSpeech)
  partOfSpeech: PartOfSpeech;

  /** Required when partOfSpeech is 'noun'; forbidden otherwise. */
  @ValidateIf((o) => o.partOfSpeech === PartOfSpeech.NOUN)
  @IsEnum(Gender)
  gender?: Gender;

  /** Optional plural form (nouns only). */
  @IsOptional()
  @IsString()
  plural?: string;

  @IsEnum(Level)
  level: Level;

  // ── Inline translations (all optional at creation time) ────────────────────

  @IsOptional()
  @IsString()
  translationFa?: string;

  @IsOptional()
  @IsString()
  translationEn?: string;

  @IsOptional()
  @IsString()
  translationRu?: string;

  @IsOptional()
  @IsString()
  translationAr?: string;

  /** Audio file URL. When provided, audioCreatedAt is set automatically. */
  @IsOptional()
  @IsString()
  audioFileUrl?: string;
}
