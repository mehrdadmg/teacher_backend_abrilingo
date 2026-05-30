import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateWordTranslationDto {
  @IsString()
  @IsNotEmpty()
  translation: string;
}
