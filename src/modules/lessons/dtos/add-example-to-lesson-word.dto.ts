import { IsInt, Min } from 'class-validator';

export class AddExampleToLessonWordDto {
  @IsInt()
  @Min(1)
  wordExampleId: number;
}
