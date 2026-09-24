import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';


export class LoginRequestDto {

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(64)
  username!: string;


  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}