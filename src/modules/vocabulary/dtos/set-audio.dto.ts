import { IsNotEmpty, IsString } from 'class-validator';

export class SetAudioDto {
  /** Full URL or storage path to the audio file (mp3 / ogg / wav). */
  @IsString()
  @IsNotEmpty()
  fileUrl: string;
}
