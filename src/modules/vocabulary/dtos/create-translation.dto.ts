import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { LanguageCode } from '../entities/word.entity';

export class CreateTranslationDto {
  @IsEnum(LanguageCode)
  languageCode: LanguageCode;

  @IsString()
  @IsNotEmpty()
  translation: string;
}
