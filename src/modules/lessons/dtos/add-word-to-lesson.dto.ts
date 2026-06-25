import { IsNotEmpty, IsString } from 'class-validator';

export class AddWordToLessonDto {
  @IsString()
  @IsNotEmpty()
  wordId: string;
}
